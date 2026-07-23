# 两个人的词典 · MVP

一个完全在浏览器本地读取、分析微信聊天 JSON 或截图的情侣词典候选生成器。文件不会上传到服务器。

## 运行

```bash
npm install
npm run dev
```

打开终端显示的本地地址，导入 `chat.json`、拖入聊天截图，或点击“体验示例数据”。截图由项目内置的离线中文 OCR 模型在浏览器内识别；为区分双方，请分别导入同一方为主的截图。

## 支持的 JSON

支持顶层消息数组，或位于 `messages`、`data`、`chatRecords`、`records` 字段中的消息数组。消息正文兼容 `content`、`text`、`message`、`msg`、`StrContent`，发送者兼容 `sender`、`from`、`name`、`nickname`、`talker`、`senderName`。

当前版本使用确定性的中文 n-gram 统计，定位是验证导入与浏览体验。下一阶段可接入 Python/jieba 分词、停用词维护、词条确认和分享卡片导出。
