package controller

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/songquanpeng/one-api/common/config"
	"github.com/songquanpeng/one-api/common/ctxkey"
	"github.com/songquanpeng/one-api/common/helper"
	"github.com/songquanpeng/one-api/model"
)

func GetAllChannels(c *gin.Context) {
	p, _ := strconv.Atoi(c.Query("p"))
	if p < 0 {
		p = 0
	}
	channels, err := model.GetAllChannels(p*config.ItemsPerPage, config.ItemsPerPage, "limited")
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    channels,
	})
	return
}

func SearchChannels(c *gin.Context) {
	keyword := c.Query("keyword")
	channels, err := model.SearchChannels(keyword)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    channels,
	})
	return
}

func GetChannel(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	channel, err := model.GetChannelById(id, false)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    channel,
	})
	return
}

func AddChannel(c *gin.Context) {
	ctx := c.Request.Context()
	channel := model.Channel{}
	err := c.ShouldBindJSON(&channel)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	channel.CreatedTime = helper.GetTimestamp()
	keys := strings.Split(channel.Key, "\n")
	channels := make([]model.Channel, 0, len(keys))
	for _, key := range keys {
		if key == "" {
			continue
		}
		localChannel := channel
		localChannel.Key = key
		channels = append(channels, localChannel)
	}
	err = model.BatchInsertChannels(channels)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	adminUserId := c.GetInt(ctxkey.Id)
	details := fmt.Sprintf("渠道名称: %s, 类型: %d, 批量创建 %d 个渠道", channel.Name, channel.Type, len(channels))
	model.RecordAdminSystemLog(ctx, adminUserId, "创建渠道", details)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func DeleteChannel(c *gin.Context) {
	ctx := c.Request.Context()
	id, _ := strconv.Atoi(c.Param("id"))

	// Get channel info before deletion for logging
	originalChannel, err := model.GetChannelById(id, false)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	channel := model.Channel{Id: id}
	err = channel.Delete()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	adminUserId := c.GetInt(ctxkey.Id)
	details := fmt.Sprintf("渠道名称: %s, 类型: %d", originalChannel.Name, originalChannel.Type)
	model.RecordAdminChannelLog(ctx, adminUserId, id, "删除渠道", details)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func DeleteDisabledChannel(c *gin.Context) {
	ctx := c.Request.Context()
	rows, err := model.DeleteDisabledChannel()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	adminUserId := c.GetInt(ctxkey.Id)
	details := fmt.Sprintf("删除了 %d 个已禁用的渠道", rows)
	model.RecordAdminSystemLog(ctx, adminUserId, "批量删除禁用渠道", details)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    rows,
	})
	return
}

func UpdateChannel(c *gin.Context) {
	ctx := c.Request.Context()
	channel := model.Channel{}
	err := c.ShouldBindJSON(&channel)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	// Get original channel for comparison
	originalChannel, err := model.GetChannelById(channel.Id, false)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	err = channel.Update()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	adminUserId := c.GetInt(ctxkey.Id)
	var changes []string

	if originalChannel.Name != channel.Name {
		changes = append(changes, fmt.Sprintf("名称从 '%s' 修改为 '%s'", originalChannel.Name, channel.Name))
	}
	if originalChannel.Status != channel.Status {
		statusNames := map[int]string{1: "启用", 2: "禁用"}
		changes = append(changes, fmt.Sprintf("状态从 %s 修改为 %s", statusNames[originalChannel.Status], statusNames[channel.Status]))
	}
	if originalChannel.Priority != channel.Priority {
		changes = append(changes, fmt.Sprintf("优先级从 %d 修改为 %d", originalChannel.Priority, channel.Priority))
	}
	if originalChannel.Weight != channel.Weight {
		changes = append(changes, fmt.Sprintf("权重从 %d 修改为 %d", originalChannel.Weight, channel.Weight))
	}

	if len(changes) > 0 {
		details := strings.Join(changes, ", ")
		model.RecordAdminChannelLog(ctx, adminUserId, channel.Id, "更新渠道", details)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    channel,
	})
	return
}
