package service

import (
	"maps"
	"slices"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
)

func GetUserUsableGroups(userGroup string) map[string]string {
	groupsCopy := setting.GetUserUsableGroupsCopy()
	if userGroup != "" {
		specialSettings, b := ratio_setting.GetGroupRatioSetting().GroupSpecialUsableGroup.Get(userGroup)
		if b {
			// 处理特殊可用分组
			for specialGroup, desc := range specialSettings {
				if after, ok := strings.CutPrefix(specialGroup, "-:"); ok {
					// 移除分组
					groupToRemove := after
					delete(groupsCopy, groupToRemove)
				} else if after, ok := strings.CutPrefix(specialGroup, "+:"); ok {
					// 添加分组
					groupToAdd := after
					groupsCopy[groupToAdd] = desc
				} else {
					// 直接添加分组
					groupsCopy[specialGroup] = desc
				}
			}
		}
		// 如果userGroup不在UserUsableGroups中，返回UserUsableGroups + userGroup。
		// 描述是英文源文本，由 web 控制台翻译；管理员配置的描述原样显示。
		if _, ok := groupsCopy[userGroup]; !ok {
			groupsCopy[userGroup] = "User group"
		}
	}
	return groupsCopy
}

func GroupInUserUsableGroups(userGroup, groupName string) bool {
	_, ok := GetUserUsableGroups(userGroup)[groupName]
	return ok
}

func IsUserSelectableGroup(userGroup, groupName string) bool {
	if groupName == "" || groupName == "auto" {
		return false
	}
	return GroupInUserUsableGroups(userGroup, groupName) && ratio_setting.ContainsGroupRatio(groupName)
}

// GetUserAutoGroup 根据用户分组获取自动分组设置
func GetUserAutoGroup(userGroup string) []string {
	autoGroups := make([]string, 0)
	seen := make(map[string]struct{})
	for _, group := range setting.GetAutoGroups() {
		if !IsUserSelectableGroup(userGroup, group) {
			continue
		}
		if _, ok := seen[group]; ok {
			continue
		}
		seen[group] = struct{}{}
		autoGroups = append(autoGroups, group)
	}
	return autoGroups
}

// FilterUserTokenAutoGroups applies current permissions before the current
// per-token limit. It intentionally does not fall back to the global Auto list.
func FilterUserTokenAutoGroups(userGroup string, groups []string) []string {
	maxCount := setting.GetMaxTokenAutoGroups()
	filtered := make([]string, 0, min(len(groups), maxCount))
	seen := make(map[string]struct{})
	for _, group := range groups {
		if !IsUserSelectableGroup(userGroup, group) {
			continue
		}
		if _, ok := seen[group]; ok {
			continue
		}
		seen[group] = struct{}{}
		filtered = append(filtered, group)
		if len(filtered) == maxCount {
			break
		}
	}
	return filtered
}

// GetRequestAutoGroups resolves the ordered Auto groups for the current token.
// The absence of the context value means that the token inherits the complete
// global Auto list; a present (even empty) value is an explicit token snapshot.
func GetRequestAutoGroups(c *gin.Context, userGroup string) []string {
	value, ok := common.GetContextKey(c, constant.ContextKeyTokenAutoGroups)
	if !ok {
		return GetUserAutoGroup(userGroup)
	}
	groups, ok := value.([]string)
	if !ok {
		return []string{}
	}
	return FilterUserTokenAutoGroups(userGroup, groups)
}

// GetGroupsEnabledModels 按 groups 顺序获取各分组启用的模型并去重
func GetGroupsEnabledModels(groups []string) []string {
	seen := make(map[string]struct{})
	models := make([]string, 0)
	for _, group := range groups {
		for _, modelName := range model.GetGroupEnabledModels(group) {
			if _, ok := seen[modelName]; !ok {
				seen[modelName] = struct{}{}
				models = append(models, modelName)
			}
		}
	}
	return models
}

type UserModelChannel struct {
	Id     int      `json:"id"`
	Name   string   `json:"name"`
	Models []string `json:"models"`
}

func GetGroupsEnabledModelChannels(groups []string) ([]UserModelChannel, error) {
	rows, err := model.GetGroupsEnabledModelChannels(groups)
	if err != nil {
		return nil, err
	}
	channels := make([]UserModelChannel, 0)
	channelIndexes := make(map[int]int)
	for _, row := range rows {
		index, ok := channelIndexes[row.ChannelId]
		if !ok {
			index = len(channels)
			channelIndexes[row.ChannelId] = index
			channels = append(channels, UserModelChannel{
				Id:     row.ChannelId,
				Name:   row.ChannelName,
				Models: make([]string, 0),
			})
		}
		channels[index].Models = append(channels[index].Models, row.Model)
	}
	return channels, nil
}

type DashboardTokenCatalogItem struct {
	TokenID          int      `json:"token_id"`
	TokenName        string   `json:"token_name"`
	AuthorizedModels []string `json:"authorized_models"`
}

func GetDashboardTokenCatalog(userId int, username string, tokenId int) ([]DashboardTokenCatalogItem, error) {
	tokens, err := model.GetDashboardTokens(userId, username, tokenId)
	if err != nil {
		return nil, err
	}
	catalog := make([]DashboardTokenCatalogItem, 0, len(tokens))
	userModels := make(map[int][]string)
	for i := range tokens {
		token := &tokens[i]
		authorizedModels := make([]string, 0)
		if token.ModelLimitsEnabled {
			seen := make(map[string]struct{})
			for _, modelName := range token.GetModelLimits() {
				modelName = strings.TrimSpace(modelName)
				if modelName == "" {
					continue
				}
				if _, ok := seen[modelName]; ok {
					continue
				}
				seen[modelName] = struct{}{}
				authorizedModels = append(authorizedModels, modelName)
			}
		} else if models, ok := userModels[token.UserId]; ok {
			authorizedModels = models
		} else {
			userGroup, err := model.GetUserGroup(token.UserId, false)
			if err != nil {
				return nil, err
			}
			groups := GetUserUsableGroups(userGroup)
			authorizedModels = GetGroupsEnabledModels(slices.Sorted(maps.Keys(groups)))
			userModels[token.UserId] = authorizedModels
		}
		catalog = append(catalog, DashboardTokenCatalogItem{
			TokenID:          token.Id,
			TokenName:        token.Name,
			AuthorizedModels: authorizedModels,
		})
	}
	return catalog, nil
}

// GetUserGroupRatio 获取用户使用某个分组的倍率
// userGroup 用户分组
// group 需要获取倍率的分组
func GetUserGroupRatio(userGroup, group string) float64 {
	ratio, ok := ratio_setting.GetGroupGroupRatio(userGroup, group)
	if ok {
		return ratio
	}
	return ratio_setting.GetGroupRatio(group)
}
