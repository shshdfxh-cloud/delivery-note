# 成品界面修正与验收 — 2026-09-22

## 改了什么

在原发布版本 51c1b71 上修改，保留原项目、原网址、真实模型记录及验收引擎。首页与 general-review.html 统一，专项检查保留在 checks.html，历史版本保留在 legacy/。

默认中文，英语由独立切换按钮选择并记住；不再逐句双语混排。界面状态、帮助、报错摘要、报告标题、机器计数展示和 Markdown 导出按界面语言显示。示例叙述作了明确标注的展示层翻译/整理；原文引句、指纹、实际结果及证据 JSON 不改写。用户自己的材料和模型自由文本不会被冒充为已翻译。

首页建立目的说明、示例、工作台的层次；材料卡片和审查/报告切换分开。完整提示词、原始机器记录默认折叠，按需要显示；手机改为单列，无固定内部滚动框。报告先展示结论和各类发现数量，再展示逐项目的、原文、独立检查及下一步。错误不再套绿色通过样式。

支持拖入或选择文件、角色标记、清空与替换确认。改变目的、材料、授权或模型回复会清除对应旧结果；语言切换不改变原始材料。助手队列状态有停止等待和读取同一任务入口，不自动重新提交。

## 实际验证

真实浏览器操作：默认中文、切换并记住英文、录制 SERV 样例重新计算 10/12、四条发现和缺负责人证据、展开逐字引文、中英文报告下载、JSON证据下载、实际文件上传/角色修改、授权要求、伪造引文拒收、正确回复导入、修改目的使旧报告及下载失效、PDF拒收且不损失原文件、专项数据检查入口仍可运行。

320 / 390 / 768 / 1024 / 1707 像素宽度检查无横向溢出；另检查1440桌面。实际渲染截图保存在 verification/ui-refresh/，并已查看桌面首页、操作区、报告和手机报告。截图使用测试浏览器的减少动画模式避免截到滚动过程，不修改用户浏览器设置。

12项浏览器场景、26项已有Python测试、33项Node测试通过。助手队列前端验证使用明确标注的测试响应，不冒称新模型实跑。审核引擎、模型记录和来源证据均保持原样。此轮没有向SERV发出新模型请求，也未提取密钥。

## 重现

运行 `python scripts/verify_ui_refresh.py`；需要本机已安装的Edge、Playwright、Python和Node。脚本使用独立无窗口浏览器与临时本地服务，结束后关闭它们，不复用用户登录数据。可使用 `--base-url https://shshdfxh-cloud.github.io/delivery-note/` 复测公开页；该模式不运行本地队列替代响应测试。

公开页仍是本机文件检查、真实录制回放或手动转交；本地AI助手接手和API模式的既有边界没有因界面修改而扩大。此次不重填报名、不新增X帖。

- The public UI now defaults to English; Chinese is available from the language switch. The recorded training example also shows an English customer objective and English finding explanations in English mode, while exact source quotations remain unchanged.
