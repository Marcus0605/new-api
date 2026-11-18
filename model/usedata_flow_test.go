package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func seedFlowQuotaData(t *testing.T, quotaData QuotaData) {
	t.Helper()
	require.NoError(t, DB.Create(&quotaData).Error)
}

func seedFlowLookupData(t *testing.T) {
	t.Helper()
	require.NoError(t, DB.Create(&Channel{Id: 1, Name: "east"}).Error)
	require.NoError(t, DB.Create(&Channel{Id: 2, Name: "west"}).Error)
	require.NoError(t, DB.Create(&Token{Id: 11, UserId: 1, Key: "sk-primary", Name: "primary"}).Error)
	require.NoError(t, DB.Create(&Token{Id: 22, UserId: 2, Key: "sk-backup", Name: "backup"}).Error)
	require.NoError(t, DB.Delete(&Token{Id: 11}).Error)
}

func TestGetFlowQuotaDataUsesQuotaDataRoleSpecificDimensions(t *testing.T) {
	truncateTables(t)
	seedFlowLookupData(t)

	seedFlowQuotaData(t, QuotaData{
		UserID:    1,
		Username:  "alice",
		NodeName:  "node-a",
		TokenID:   11,
		UseGroup:  "vip",
		ModelName: "gpt-a",
		ChannelID: 1,
		CreatedAt: 1000,
		Count:     2,
		Quota:     100,
		TokenUsed: 40,
	})
	seedFlowQuotaData(t, QuotaData{
		UserID:    1,
		Username:  "alice",
		NodeName:  "node-a",
		TokenID:   11,
		UseGroup:  "vip",
		ModelName: "gpt-a",
		ChannelID: 1,
		CreatedAt: 1100,
		Count:     1,
		Quota:     50,
		TokenUsed: 20,
	})
	seedFlowQuotaData(t, QuotaData{
		UserID:    1,
		Username:  "alice",
		NodeName:  "node-a",
		TokenID:   11,
		UseGroup:  "vip",
		ModelName: "gpt-a",
		ChannelID: 2,
		CreatedAt: 1200,
		Count:     1,
		Quota:     25,
		TokenUsed: 10,
	})
	seedFlowQuotaData(t, QuotaData{
		UserID:    2,
		Username:  "bob",
		NodeName:  "node-b",
		TokenID:   22,
		UseGroup:  "default",
		ModelName: "gpt-b",
		ChannelID: 1,
		CreatedAt: 1300,
		Count:     3,
		Quota:     70,
		TokenUsed: 30,
	})
	seedFlowQuotaData(t, QuotaData{
		UserID:    1,
		Username:  "alice",
		ModelName: "legacy",
		CreatedAt: 1400,
		Count:     99,
		Quota:     999,
		TokenUsed: 999,
	})

	rootRows, err := GetFlowQuotaData(900, 2000, "", 0, common.RoleRootUser, 0)
	require.NoError(t, err)
	require.Len(t, rootRows, 3)
	// Token 11 was soft-deleted, so its name is intentionally left empty for the
	// frontend to render a localized "deleted (id)" label instead.
	require.Equal(t, FlowQuotaData{
		UserID:      1,
		Username:    "alice",
		NodeName:    "node-a",
		TokenID:     11,
		TokenName:   "",
		UseGroup:    "vip",
		ChannelID:   1,
		ChannelName: "east",
		ModelName:   "gpt-a",
		TokenUsed:   60,
		Count:       3,
		Quota:       150,
	}, *rootRows[0])
	// A token that still exists resolves to its current name.
	require.Equal(t, 22, rootRows[1].TokenID)
	require.Equal(t, "backup", rootRows[1].TokenName)

	adminRows, err := GetFlowQuotaData(900, 2000, "alice", 0, common.RoleAdminUser, 0)
	require.NoError(t, err)
	require.Len(t, adminRows, 2)
	require.Equal(t, 0, adminRows[0].TokenID)
	require.Empty(t, adminRows[0].TokenName)
	require.Empty(t, adminRows[0].NodeName)
	require.Equal(t, "alice", adminRows[0].Username)
	require.Equal(t, "vip", adminRows[0].UseGroup)
	require.Equal(t, "east", adminRows[0].ChannelName)
	require.Equal(t, 150, adminRows[0].Quota)

	selfRows, err := GetFlowQuotaData(900, 2000, "", 1, common.RoleCommonUser, 0)
	require.NoError(t, err)
	require.Len(t, selfRows, 1)
	require.Empty(t, selfRows[0].Username)
	require.Equal(t, 0, selfRows[0].ChannelID)
	require.Empty(t, selfRows[0].ChannelName)
	require.Empty(t, selfRows[0].TokenName)
	require.Equal(t, "vip", selfRows[0].UseGroup)
	require.Equal(t, 175, selfRows[0].Quota)
}

func TestDashboardQueriesFilterByTokenID(t *testing.T) {
	truncateTables(t)
	seedFlowLookupData(t)
	seedFlowQuotaData(t, QuotaData{
		UserID: 1, Username: "alice", TokenID: 11, UseGroup: "default",
		ModelName: "gpt-a", CreatedAt: 1000, Count: 1, TokenUsed: 15, CacheReadTokens: 6,
	})
	seedFlowQuotaData(t, QuotaData{
		UserID: 1, Username: "alice", TokenID: 22, UseGroup: "default",
		ModelName: "gpt-a", CreatedAt: 1000, Count: 2, TokenUsed: 27, CacheReadTokens: 9,
	})
	seedFlowQuotaData(t, QuotaData{
		UserID: 2, Username: "bob", TokenID: 22, UseGroup: "default",
		ModelName: "gpt-b", CreatedAt: 1000, Count: 1, TokenUsed: 99,
	})
	require.NoError(t, DB.Create(&Log{
		UserId: 1, Username: "alice", TokenId: 11, TokenName: "shared",
		ModelName: "gpt-a", CreatedAt: 1000, Type: LogTypeConsume,
		PromptTokens: 10, CompletionTokens: 5,
	}).Error)
	require.NoError(t, DB.Create(&Log{
		UserId: 1, Username: "alice", TokenId: 22, TokenName: "shared",
		ModelName: "gpt-a", CreatedAt: 1000, Type: LogTypeConsume,
		PromptTokens: 20, CompletionTokens: 7,
	}).Error)
	require.NoError(t, DB.Create(&Log{
		UserId: 1, Username: "alice", TokenId: 22, TokenName: "shared",
		ModelName: "gpt-b", CreatedAt: 1000, Type: LogTypeConsume,
		PromptTokens: 4, CompletionTokens: 3,
	}).Error)
	require.NoError(t, DB.Create(&Log{
		UserId: 1, Username: "alice", TokenId: 11, TokenName: "shared",
		ModelName: "gpt-a", CreatedAt: 1000, Type: LogTypeError,
	}).Error)
	for range 2 {
		require.NoError(t, DB.Create(&Log{
			UserId: 1, Username: "alice", TokenId: 22, TokenName: "shared",
			ModelName: "gpt-b", CreatedAt: 1000, Type: LogTypeError,
		}).Error)
	}

	allRows, err := GetAllQuotaDates(900, 2000, "", 11)
	require.NoError(t, err)
	require.Len(t, allRows, 1)
	require.Equal(t, 15, allRows[0].TokenUsed)

	selfRows, err := GetQuotaDataByUserId(1, 900, 2000, 22)
	require.NoError(t, err)
	require.Len(t, selfRows, 1)
	require.Equal(t, 27, selfRows[0].TokenUsed)

	stat, err := SumUsedQuota(LogTypeConsume, 900, 2000, "", "alice", "shared", 0, "", 11, "")
	require.NoError(t, err)
	require.Equal(t, int64(10), stat.PromptTokens)
	require.Equal(t, int64(5), stat.CompletionTokens)
	require.Equal(t, []ModelStat{{ModelName: "gpt-a", PromptTokens: 10, CompletionTokens: 5, FailedCount: 1}}, stat.Models)
	require.Equal(t, []TokenStat{{TokenID: 11, TokenName: "shared", PromptTokens: 10, CompletionTokens: 5, FailedCount: 1}}, stat.Tokens)

	allStat, err := SumUsedQuota(LogTypeConsume, 900, 2000, "", "alice", "shared", 0, "", 0, "")
	require.NoError(t, err)
	require.Len(t, allStat.Models, 2)
	modelStats := make(map[string]ModelStat, len(allStat.Models))
	for _, modelStat := range allStat.Models {
		modelStats[modelStat.ModelName] = modelStat
	}
	require.Equal(t, ModelStat{ModelName: "gpt-a", PromptTokens: 30, CompletionTokens: 12, FailedCount: 1}, modelStats["gpt-a"])
	require.Equal(t, ModelStat{ModelName: "gpt-b", PromptTokens: 4, CompletionTokens: 3, FailedCount: 2}, modelStats["gpt-b"])
	require.Len(t, allStat.Tokens, 2)
	tokenStats := make(map[int]TokenStat, len(allStat.Tokens))
	for _, tokenStat := range allStat.Tokens {
		tokenStats[tokenStat.TokenID] = tokenStat
	}
	require.Equal(t, TokenStat{TokenID: 11, TokenName: "shared", PromptTokens: 10, CompletionTokens: 5, FailedCount: 1}, tokenStats[11])
	require.Equal(t, TokenStat{TokenID: 22, TokenName: "shared", PromptTokens: 24, CompletionTokens: 10, FailedCount: 2}, tokenStats[22])

	tokenQuota, err := GetTokenQuotaStats(900, 2000, "alice", 0)
	require.NoError(t, err)
	require.ElementsMatch(t, []TokenQuotaStat{
		{TokenID: 11, RequestCount: 1, TotalTokens: 15, CacheReadTokens: 6},
		{TokenID: 22, RequestCount: 2, TotalTokens: 27, CacheReadTokens: 9},
	}, tokenQuota)
	filteredTokenQuota, err := GetTokenQuotaStats(900, 2000, "alice", 11)
	require.NoError(t, err)
	require.Equal(t, []TokenQuotaStat{{TokenID: 11, RequestCount: 1, TotalTokens: 15, CacheReadTokens: 6}}, filteredTokenQuota)

	rootRows, err := GetFlowQuotaData(900, 2000, "", 0, common.RoleRootUser, 11)
	require.NoError(t, err)
	require.Len(t, rootRows, 1)
	require.Equal(t, 11, rootRows[0].TokenID)
	require.Equal(t, 15, rootRows[0].TokenUsed)

	selfFlowRows, err := GetFlowQuotaData(900, 2000, "", 1, common.RoleCommonUser, 22)
	require.NoError(t, err)
	require.Len(t, selfFlowRows, 1)
	require.Equal(t, 22, selfFlowRows[0].TokenID)
	require.Equal(t, 27, selfFlowRows[0].TokenUsed)
}

func TestLogTagFilterAndOptions(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&[]Model{
		{ModelName: "gpt-exact", Tags: "coding, fast"},
		{ModelName: "claude", NameRule: NameRulePrefix, Tags: "coding"},
		{ModelName: "gpt-other", Tags: "other"},
	}).Error)
	require.NoError(t, DB.Create(&[]Channel{{Id: 3, Name: "east"}, {Id: 4, Name: "west"}}).Error)
	require.NoError(t, DB.Create(&[]Log{
		{UserId: 1, Username: "alice", TokenName: "alpha", ModelName: "gpt-exact", Type: LogTypeConsume, PromptTokens: 10, CompletionTokens: 2},
		{UserId: 1, Username: "alice", TokenName: "alpha", ModelName: "claude-3", Type: LogTypeConsume, PromptTokens: 20, CompletionTokens: 3},
		{UserId: 2, Username: "bob", TokenName: "beta", ModelName: "gpt-exact", Type: LogTypeConsume, PromptTokens: 40, CompletionTokens: 5},
		{UserId: 2, Username: "bob", TokenName: "beta", ModelName: "gpt-other", Type: LogTypeConsume, PromptTokens: 80, CompletionTokens: 7},
	}).Error)

	logs, total, err := GetAllLogs(LogFilter{Tag: "coding"}, 0, 20)
	require.NoError(t, err)
	require.Equal(t, int64(3), total)
	require.Len(t, logs, 3)

	logs, total, err = GetAllLogs(LogFilter{Tag: "coding", ModelName: "gpt-exact"}, 0, 20)
	require.NoError(t, err)
	require.Equal(t, int64(2), total)
	require.Len(t, logs, 2)
	for _, log := range logs {
		require.Equal(t, "gpt-exact", log.ModelName)
	}

	_, total, err = GetUserLogs(1, LogFilter{Tag: "coding"}, 0, 20)
	require.NoError(t, err)
	require.Equal(t, int64(2), total)
	_, total, err = GetAllLogs(LogFilter{Tag: "missing"}, 0, 20)
	require.NoError(t, err)
	require.Zero(t, total)

	stat, err := SumUsedQuota(LogTypeConsume, 0, 0, "", "alice", "", 0, "", 0, "coding")
	require.NoError(t, err)
	require.Equal(t, int64(30), stat.PromptTokens)
	require.Equal(t, int64(5), stat.CompletionTokens)

	adminOptions, err := GetLogFilterOptions(0, true)
	require.NoError(t, err)
	require.Equal(t, []string{"claude-3", "gpt-exact", "gpt-other"}, adminOptions.Models)
	require.Equal(t, []string{"alpha", "beta"}, adminOptions.Tokens)
	require.Equal(t, []string{"alice", "bob"}, adminOptions.Users)
	require.Equal(t, []LogChannelOption{{ID: 3, Name: "east"}, {ID: 4, Name: "west"}}, adminOptions.Channels)
	require.Equal(t, []string{"coding", "fast", "other"}, adminOptions.Tags)

	userOptions, err := GetLogFilterOptions(1, false)
	require.NoError(t, err)
	require.Equal(t, []string{"claude-3", "gpt-exact"}, userOptions.Models)
	require.Equal(t, []string{"alpha"}, userOptions.Tokens)
	require.Empty(t, userOptions.Users)
	require.Empty(t, userOptions.Channels)
	require.Equal(t, adminOptions.Tags, userOptions.Tags)
}

func TestLogQuotaDataSplitsRowsByUseGroupTokenChannelAndNode(t *testing.T) {
	truncateTables(t)
	CacheQuotaDataLock.Lock()
	CacheQuotaData = make(map[string]*QuotaData)
	CacheQuotaDataLock.Unlock()

	LogQuotaData(QuotaDataLogParams{
		UserID:    1,
		Username:  "alice",
		ModelName: "gpt-a",
		CreatedAt: 3661,
		UseGroup:  "vip",
		TokenID:   11,
		ChannelID: 1,
		NodeName:  "node-a",
		Quota:     100,
		TokenUsed: 40,
	})
	LogQuotaData(QuotaDataLogParams{
		UserID:    1,
		Username:  "alice",
		ModelName: "gpt-a",
		CreatedAt: 3700,
		UseGroup:  "vip",
		TokenID:   11,
		ChannelID: 1,
		NodeName:  "node-a",
		Quota:     50,
		TokenUsed: 20,
	})
	LogQuotaData(QuotaDataLogParams{
		UserID:    1,
		Username:  "alice",
		ModelName: "gpt-a",
		CreatedAt: 3700,
		UseGroup:  "default",
		TokenID:   11,
		ChannelID: 1,
		NodeName:  "node-a",
		Quota:     25,
		TokenUsed: 10,
	})

	SaveQuotaDataCache()

	var rows []QuotaData
	require.NoError(t, DB.Order("quota DESC").Find(&rows).Error)
	require.Len(t, rows, 2)
	require.Equal(t, int64(3600), rows[0].CreatedAt)
	require.Equal(t, "vip", rows[0].UseGroup)
	require.Equal(t, 11, rows[0].TokenID)
	require.Equal(t, 1, rows[0].ChannelID)
	require.Equal(t, "node-a", rows[0].NodeName)
	require.Equal(t, 2, rows[0].Count)
	require.Equal(t, 150, rows[0].Quota)
	require.Equal(t, 60, rows[0].TokenUsed)
	require.Equal(t, "default", rows[1].UseGroup)
	require.Equal(t, 25, rows[1].Quota)
}
