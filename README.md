## 该项目为通过CodeX完成的自用项目，仅供交流学习

一个运行在 `Atlas` 浏览器里的自动签到扩展，当前已接入 `Bilibili 大会员经验签到`，并支持通过 macOS `launchd` 在每天 `09:00` 自动拉起 `Atlas` 后执行任务。

## 当前能力

- `Atlas` 已开着时：扩展会在每天 `09:00` 自动执行
- `Atlas` 没开时：`launchd` 会在每天 `09:00` 后台启动 `Atlas`
- `Atlas` 启动后：扩展通过 `onStartup + 补跑` 自动执行当天任务
- 支持手动立即执行、状态查看、自动签到开关

## 环境要求

在安装前先确认：

1. `Atlas` 安装在 `/Applications/ChatGPT Atlas.app`
2. B 站账号已经登录在 `Atlas` 默认资料里
3. 每天 `09:00` 时，这台 Mac 已开机且当前用户已登录
4. 使用的是 macOS，且本机可执行 `launchctl`

## 本地开发与构建

安装依赖：

```bash
npm install
```

构建扩展产物：

```bash
npm run build
```

运行测试：

```bash
npm test
```

## 在 Atlas 中加载扩展

1. 打开 `atlas://extensions`
2. 打开开发者模式
3. 选择“加载未打包的扩展程序”
4. 选择本项目构建后的 `dist/` 目录
5. 后续每次改代码后，重新执行 `npm run build`，再在扩展页点一次“更新”

## 安装自动启动任务

给脚本执行权限并安装 `LaunchAgent`：

```bash
chmod +x ops/launch-atlas-checkin.sh ops/install-launch-agent.sh
bash ops/install-launch-agent.sh
```

安装脚本会自动：

- 把启动脚本复制到 `$HOME/Library/Application Support/bilibili-auto-signin-ji`
- 按当前用户目录生成专属 `plist`
- 安装并加载 `LaunchAgent`
- 清理旧版 `com.alberlat.atlas-bilibili-checkin` 配置

查看当前 `LaunchAgent` 状态：

```bash
launchctl print "gui/$(id -u)/com.bilibili-auto-signin-ji.atlas-checkin"
```

手动触发一次：

```bash
launchctl kickstart -k "gui/$(id -u)/com.bilibili-auto-signin-ji.atlas-checkin"
```

卸载：

```bash
launchctl bootout "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.bilibili-auto-signin-ji.atlas-checkin.plist"
rm -f "$HOME/Library/LaunchAgents/com.bilibili-auto-signin-ji.atlas-checkin.plist"
rm -rf "$HOME/Library/Application Support/bilibili-auto-signin-ji"
```

## 日志查看

标准输出日志：

```bash
tail -f "$HOME/Library/Logs/atlas-bilibili-checkin.log"
```

错误日志：

```bash
tail -f "$HOME/Library/Logs/atlas-bilibili-checkin.error.log"
```

## 已知边界

- 不会在电脑睡眠中强制唤醒执行
- 不会自动退出 `Atlas`
- 不处理多个 `Atlas` 资料或多个 B 站账号
- 如果 `Atlas` 已经开着，系统脚本不会重复拉起，由扩展自己的 `09:00 alarm` 负责执行
Uploading README.md…]()
