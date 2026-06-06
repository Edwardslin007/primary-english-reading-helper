# 小学生英文朗读辅助工具

一个移动端优先的英文朗读练习网页，使用原生 HTML、CSS、JavaScript 实现，不需要后端。

当前冻结版本：V1.0

当前线上补丁版本：V1.0.2

版本更新介绍见：

```text
docs/releases/v1.0.md
```

V1.0.1 手机播放修复说明见：

```text
docs/releases/v1.0.1.md
```

V1.0.2 长句播放修复说明见：

```text
docs/releases/v1.0.2.md
```

## 运行方式

```powershell
npm run serve
```

然后打开：

```text
http://127.0.0.1:4173/
```

也可以直接运行：

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

## 修改内容

主要内容集中在：

```text
src/reading-data.mjs
```

- `readingCards`：英文句子、中文翻译、拆句短语
- `wordDefinitions`：单词中文释义

修改句子后建议运行：

```powershell
npm test
```

测试会检查句子数量、拆句是否能拼回原句、每个朗读单词是否有释义。

## 说明

语音朗读使用浏览器 Web Speech API。不同电脑和浏览器可用音色不同，应用会优先选择英语女声、自然英语音色，并使用美音朗读参数。

在部分手机浏览器或微信内置浏览器中，如果 Web Speech API 不可用，页面会自动切换到 HTTPS 远程音频兜底播放，避免播放按钮变灰无法点击。
