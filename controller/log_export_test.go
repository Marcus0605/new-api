package controller

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// callLogHandler runs a log handler as the given user and returns the JSON
// lines of the response.
func callLogHandler(t *testing.T, handler gin.HandlerFunc, userId int, role int, query string) []map[string]any {
	t.Helper()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/log?"+query, nil)
	ctx.Set("id", userId)
	ctx.Set("role", role)
	if userId == 1 {
		ctx.Set("username", "alice")
	} else if userId == 2 {
		ctx.Set("username", "bob")
	}
	handler(ctx)
	var lines []map[string]any
	for line := range strings.SplitSeq(strings.TrimSpace(recorder.Body.String()), "\n") {
		var value map[string]any
		require.NoError(t, common.UnmarshalJsonStr(line, &value))
		lines = append(lines, value)
	}
	return lines
}

func exportedRequestIds(lines []map[string]any) []any {
	ids := make([]any, 0, len(lines))
	for _, line := range lines[:len(lines)-1] {
		ids = append(ids, line["request_id"])
	}
	return ids
}

// seedExportLogs stores logs of two users: three in the last hour and one
// from 400 days ago.
func seedExportLogs(t *testing.T, mainDB *gorm.DB, logDB *gorm.DB, now int64) {
	t.Helper()
	require.NoError(t, mainDB.Create(&model.Channel{Id: 9, Name: "primary"}).Error)
	users := []model.User{
		{Id: 1, Username: "alice", Group: "default", AffCode: "alice"},
		{Id: 2, Username: "bob", Group: "default", AffCode: "bob"},
	}
	for i := range users {
		require.NoError(t, mainDB.Create(&users[i]).Error)
	}
	tokens := []model.Token{
		{Id: 11, UserId: 1, Key: "alice-first", Name: "alice-first", ModelLimitsEnabled: true, ModelLimits: "gpt-a, gpt-b,gpt-a"},
		{Id: 12, UserId: 1, Key: "alice-unused", Name: "alice-unused", ModelLimitsEnabled: true, ModelLimits: "gpt-c"},
		{Id: 21, UserId: 2, Key: "bob-first", Name: "bob-first", ModelLimitsEnabled: true, ModelLimits: "gpt-b"},
	}
	for i := range tokens {
		require.NoError(t, mainDB.Create(&tokens[i]).Error)
	}
	logs := []model.Log{
		{UserId: 1, Username: "alice", CreatedAt: now - 3600, Type: model.LogTypeConsume, ModelName: "gpt-a", ChannelId: 9, Quota: 10, PromptTokens: 100, CompletionTokens: 50, UseTime: 10, RequestId: "a-1", Other: `{"cache_tokens":40,"admin_info":{"use_channel":["9"]}}`},
		{UserId: 2, Username: "bob", CreatedAt: now - 1800, Type: model.LogTypeConsume, ModelName: "gpt-b", ChannelId: 9, Quota: 20, PromptTokens: 200, CompletionTokens: 100, UseTime: 30, RequestId: "b-1", Other: `{"cache_tokens":60}`},
		{UserId: 1, Username: "alice", CreatedAt: now - 60, Type: model.LogTypeError, ModelName: "gpt-a", RequestId: "a-2"},
		{UserId: 1, Username: "alice", CreatedAt: now - 400*24*3600, Type: model.LogTypeConsume, ModelName: "gpt-a", RequestId: "a-old"},
	}
	for i := range logs {
		require.NoError(t, logDB.Create(&logs[i]).Error)
	}
}

func useLogExportDatabases(t *testing.T, mainDB *gorm.DB, logDB *gorm.DB, mainType common.DatabaseType, logType common.DatabaseType) {
	t.Helper()
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousMain, previousLog := common.MainDatabaseType(), common.LogDatabaseType()
	previousRedis, previousMemory := common.RedisEnabled, common.MemoryCacheEnabled
	model.DB, model.LOG_DB = mainDB, logDB
	common.SetDatabaseTypes(mainType, logType)
	common.RedisEnabled, common.MemoryCacheEnabled = false, false
	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.SetDatabaseTypes(previousMain, previousLog)
		common.RedisEnabled, common.MemoryCacheEnabled = previousRedis, previousMemory
	})
}

func TestLogExportDatabaseMatrix(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previousMaster := common.IsMasterNode
	common.IsMasterNode = true
	t.Cleanup(func() { common.IsMasterNode = previousMaster })
	for _, tc := range []struct {
		kind, env string
		typ       common.DatabaseType
	}{
		{"sqlite", "", common.DatabaseTypeSQLite},
		{"mysql", "AUDIT_MYSQL_DSN", common.DatabaseTypeMySQL},
		{"postgres", "AUDIT_POSTGRES_DSN", common.DatabaseTypePostgreSQL},
		{"clickhouse", "AUDIT_CLICKHOUSE_DSN", common.DatabaseTypeClickHouse},
	} {
		t.Run(tc.kind, func(t *testing.T) {
			dsn := os.Getenv(tc.env)
			if tc.env != "" && dsn == "" {
				t.Skip(tc.env + " is not configured")
			}
			db, isolatedDSN := newAuditTestDatabase(t, tc.kind, dsn)
			mainDB, mainType := db, tc.typ
			if tc.kind == "clickhouse" {
				mainDB, _ = newAuditTestDatabase(t, "sqlite", "")
				mainType = common.DatabaseTypeSQLite
			}
			useLogExportDatabases(t, mainDB, db, mainType, tc.typ)
			require.NoError(t, mainDB.AutoMigrate(&model.Channel{}, &model.QuotaData{}, &model.User{}, &model.Token{}, &model.Ability{}))
			if tc.kind == "clickhouse" {
				t.Setenv("LOG_SQL_DSN", isolatedDSN)
				require.NoError(t, model.InitLogDB())
			} else {
				require.NoError(t, db.AutoMigrate(&model.Log{}))
			}
			versionSQL := "SELECT version()"
			if tc.kind == "sqlite" {
				versionSQL = "SELECT sqlite_version()"
			}
			var version string
			require.NoError(t, model.LOG_DB.Raw(versionSQL).Scan(&version).Error)
			t.Logf("log database: %s %s", tc.kind, version)
			now := time.Now().Unix()
			seedExportLogs(t, mainDB, model.LOG_DB, now)
			query := fmt.Sprintf("start_timestamp=%d&end_timestamp=%d", now-2*24*3600, now+3600)

			listed := callLogHandler(t, GetUserLogs, 1, common.RoleCommonUser, query)[0]
			require.Equal(t, true, listed["success"])
			assert.EqualValues(t, 2, listed["data"].(map[string]any)["total"])
			listed = callLogHandler(t, GetAllLogs, 3, common.RoleAdminUser, query+"&username=alice")[0]
			require.Equal(t, true, listed["success"])
			assert.EqualValues(t, 2, listed["data"].(map[string]any)["total"])

			selfStat := callLogHandler(t, GetLogsSelfStat, 1, common.RoleCommonUser, query)[0]
			require.Equal(t, true, selfStat["success"])
			assert.EqualValues(t, 100, selfStat["data"].(map[string]any)["prompt_tokens"])
			assert.EqualValues(t, 50, selfStat["data"].(map[string]any)["completion_tokens"])
			assert.EqualValues(t, 40, selfStat["data"].(map[string]any)["cache_read_tokens"])
			assert.EqualValues(t, 10, selfStat["data"].(map[string]any)["average_use_time"])
			selfCatalog := selfStat["data"].(map[string]any)["token_catalog"].([]any)
			require.Len(t, selfCatalog, 2)
			assert.EqualValues(t, 11, selfCatalog[0].(map[string]any)["token_id"])
			assert.Equal(t, "alice-first", selfCatalog[0].(map[string]any)["token_name"])
			assert.Equal(t, []any{"gpt-a", "gpt-b"}, selfCatalog[0].(map[string]any)["authorized_models"])
			assert.Equal(t, "alice-unused", selfCatalog[1].(map[string]any)["token_name"])
			assert.Equal(t, []any{"gpt-c"}, selfCatalog[1].(map[string]any)["authorized_models"])
			allStat := callLogHandler(t, GetLogsStat, 3, common.RoleAdminUser, query)[0]
			require.Equal(t, true, allStat["success"])
			assert.EqualValues(t, 300, allStat["data"].(map[string]any)["prompt_tokens"])
			assert.EqualValues(t, 150, allStat["data"].(map[string]any)["completion_tokens"])
			assert.EqualValues(t, 100, allStat["data"].(map[string]any)["cache_read_tokens"])
			assert.EqualValues(t, 20, allStat["data"].(map[string]any)["average_use_time"])
			allCatalog := allStat["data"].(map[string]any)["token_catalog"].([]any)
			assert.Len(t, allCatalog, 3)
			aliceStat := callLogHandler(t, GetLogsStat, 3, common.RoleAdminUser, query+"&username=alice")[0]
			require.Equal(t, true, aliceStat["success"])
			assert.Len(t, aliceStat["data"].(map[string]any)["token_catalog"], 2)
			bobStat := callLogHandler(t, GetLogsStat, 3, common.RoleAdminUser, query+"&token_id=21")[0]
			require.Equal(t, true, bobStat["success"])
			bobCatalog := bobStat["data"].(map[string]any)["token_catalog"].([]any)
			require.Len(t, bobCatalog, 1)
			assert.Equal(t, "bob-first", bobCatalog[0].(map[string]any)["token_name"])
			otherUserStat := callLogHandler(t, GetLogsSelfStat, 1, common.RoleCommonUser, query+"&token_id=21")[0]
			require.Equal(t, true, otherUserStat["success"])
			assert.Empty(t, otherUserStat["data"].(map[string]any)["token_catalog"])
			emptyStat := callLogHandler(t, GetLogsStat, 3, common.RoleAdminUser, query+"&model_name=missing")[0]
			require.Equal(t, true, emptyStat["success"])
			assert.EqualValues(t, 0, emptyStat["data"].(map[string]any)["cache_read_tokens"])
			assert.EqualValues(t, 0, emptyStat["data"].(map[string]any)["average_use_time"])

			own := callLogHandler(t, ExportUserLogs, 1, common.RoleCommonUser, query)
			require.Len(t, own, 3)
			assert.Equal(t, []any{"a-2", "a-1"}, exportedRequestIds(own))
			assert.Equal(t, map[string]any{"success": true, "message": "", "data": map[string]any{"count": float64(2)}}, own[2])
			assert.Equal(t, float64(1), own[0]["id"], "user exports carry list positions, not row ids")
			assert.Empty(t, own[1]["channel_name"])
			assert.NotContains(t, own[1]["other"], "admin_info")

			all := callLogHandler(t, ExportAllLogs, 3, common.RoleAdminUser, query+"&model_name=gpt-%25")
			require.Len(t, all, 4)
			assert.Equal(t, []any{"a-2", "b-1", "a-1"}, exportedRequestIds(all))
			assert.Equal(t, "primary", all[2]["channel_name"])
			assert.Contains(t, all[2]["other"], "admin_info")
			assert.Equal(t, true, all[3]["success"])
		})
	}
}

func TestLogExportRules(t *testing.T) {
	gin.SetMode(gin.TestMode)
	initModelListColumnNames(t)
	db, _ := newAuditTestDatabase(t, "sqlite", "")
	useLogExportDatabases(t, db, db, common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Log{}, &model.QuotaData{}, &model.User{}, &model.Token{}, &model.Ability{}))
	now := time.Now().Unix()
	seedExportLogs(t, db, db, now)
	logSetting := operation_setting.GetLogSetting()
	previousSetting := *logSetting
	t.Cleanup(func() { *logSetting = previousSetting })
	recent := fmt.Sprintf("start_timestamp=%d&end_timestamp=%d", now-2*24*3600, now)
	tooLong := fmt.Sprintf("start_timestamp=%d&end_timestamp=%d", now-366*24*3600, now)

	t.Run("unrestricted keys inherit user models", func(t *testing.T) {
		require.NoError(t, db.Create(&model.Token{Id: 13, UserId: 1, Key: "alice-unrestricted", Name: "alice-unrestricted"}).Error)
		require.NoError(t, db.Create(&model.Ability{Group: "default", Model: "gpt-d", ChannelId: 9, Enabled: true}).Error)
		stat := callLogHandler(t, GetLogsSelfStat, 1, common.RoleCommonUser, recent)[0]
		require.Equal(t, true, stat["success"])
		catalog := stat["data"].(map[string]any)["token_catalog"].([]any)
		require.Len(t, catalog, 3)
		assert.Equal(t, "alice-unrestricted", catalog[2].(map[string]any)["token_name"])
		assert.Equal(t, []any{"gpt-d"}, catalog[2].(map[string]any)["authorized_models"])
	})

	t.Run("time range", func(t *testing.T) {
		rejected := callLogHandler(t, ExportAllLogs, 3, common.RoleAdminUser, tooLong)
		require.Len(t, rejected, 1)
		assert.Equal(t, false, rejected[0]["success"])
		assert.Equal(t, "The time range cannot exceed {{days}} days", rejected[0]["message_key"])
		assert.Equal(t, map[string]any{"days": float64(365)}, rejected[0]["message_params"])

		assert.Equal(t, false, callLogHandler(t, GetUserLogs, 1, common.RoleCommonUser, tooLong)[0]["success"])
		assert.Equal(t, false, callLogHandler(t, GetLogsSelfStat, 1, common.RoleCommonUser, tooLong)[0]["success"])
		assert.Equal(t, true, callLogHandler(t, GetUserLogs, 3, common.RoleAdminUser, tooLong)[0]["success"], "administrators search their own logs without a limit")

		// The dashboard follows the same range instead of its old one-month limit.
		fortyDays := fmt.Sprintf("start_timestamp=%d&end_timestamp=%d", now-40*24*3600, now)
		for _, handler := range []gin.HandlerFunc{GetUserQuotaDates, GetUserFlowQuotaDates} {
			assert.Equal(t, "The time range cannot exceed {{days}} days", callLogHandler(t, handler, 1, common.RoleCommonUser, tooLong)[0]["message_key"])
			assert.Equal(t, true, callLogHandler(t, handler, 1, common.RoleCommonUser, fortyDays)[0]["success"])
		}

		// Without a start, a user's search reaches back the whole range.
		listed := callLogHandler(t, GetUserLogs, 1, common.RoleCommonUser, "")[0]
		assert.Equal(t, true, listed["success"])
		assert.EqualValues(t, 2, listed["data"].(map[string]any)["total"])

		logSetting.MaxRangeDays = 400
		assert.Equal(t, true, callLogHandler(t, GetUserLogs, 1, common.RoleCommonUser, tooLong)[0]["success"])
		logSetting.MaxRangeDays = previousSetting.MaxRangeDays
	})

	t.Run("user export switch", func(t *testing.T) {
		logSetting.UserExportEnabled = false
		t.Cleanup(func() { logSetting.UserExportEnabled = previousSetting.UserExportEnabled })
		disabled := callLogHandler(t, ExportUserLogs, 1, common.RoleCommonUser, recent)
		require.Len(t, disabled, 1)
		assert.Equal(t, "Log export is disabled", disabled[0]["message_key"])
		assert.Equal(t, true, callLogHandler(t, ExportUserLogs, 3, common.RoleAdminUser, recent)[0]["success"], "administrators export their own logs even when users cannot")
	})

	t.Run("one export per user", func(t *testing.T) {
		release, ok, err := service.AcquireLogExportLock(1)
		require.NoError(t, err)
		require.True(t, ok)
		busy := callLogHandler(t, ExportUserLogs, 1, common.RoleCommonUser, recent)
		require.Len(t, busy, 1)
		assert.Equal(t, "Another log export is running. Try again after it finishes.", busy[0]["message_key"])
		other := callLogHandler(t, ExportUserLogs, 2, common.RoleCommonUser, recent)
		assert.Equal(t, true, other[len(other)-1]["success"], "other users are not blocked")
		release()
		assert.Len(t, callLogHandler(t, ExportUserLogs, 1, common.RoleCommonUser, recent), 3)
	})
}

func TestAcquireLogExportLock(t *testing.T) {
	for _, useRedis := range []bool{false, true} {
		t.Run(fmt.Sprintf("redis=%v", useRedis), func(t *testing.T) {
			previousRedis, previousClient := common.RedisEnabled, common.RDB
			common.RedisEnabled = useRedis
			if useRedis {
				server := miniredis.RunT(t)
				common.RDB = redis.NewClient(&redis.Options{Addr: server.Addr()})
				require.NoError(t, common.RDB.Ping(context.Background()).Err())
			}
			t.Cleanup(func() { common.RedisEnabled, common.RDB = previousRedis, previousClient })

			release, ok, err := service.AcquireLogExportLock(1)
			require.NoError(t, err)
			require.True(t, ok)
			_, ok, err = service.AcquireLogExportLock(1)
			require.NoError(t, err)
			assert.False(t, ok, "a second export of the same user must wait")
			releaseOther, ok, err := service.AcquireLogExportLock(2)
			require.NoError(t, err)
			assert.True(t, ok)
			releaseOther()
			release()
			releaseAgain, ok, err := service.AcquireLogExportLock(1)
			require.NoError(t, err)
			assert.True(t, ok, "a finished export frees the user")
			releaseAgain()
		})
	}
}
