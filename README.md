# 图片瀑布流
> 横屏排列
> ![图片瀑布流](/images/1abf12.png)

> 竖屏排列
> ![图片瀑布流](/images/5a0135.png)


# 演示地址
[https://waterfall.41331.xyz/](https://waterfall.41331.xyz/)



# 图片瀑布流查看器

这是一个基于 HTML+JavaScript 的简单图片瀑布流查看器，使用 File System Access API 打开本地目录、预览图片并支持删除操作。

注意：File System Access API 目前在 Chromium 浏览器（Chrome / Edge）上可用，且需要通过安全上下文（https 或 localhost）运行，直接在文件系统打开 `file://` 方式可能受限。建议使用本地静态服务器。

运行示例（在项目目录运行）：

```
# 使用 Python 3 的简易服务器
python -m http.server 8000

# 或者使用 Node 的 http-server (需先安装：npm i -g http-server)
http-server -c-1
```

在浏览器中打开 `http://localhost:8000`，点击“打开图片目录”，选择包含图片的本地文件夹。

## 功能特性

- 自动懒加载：仅在图片滚动至视窗附近时才读取文件，减少内存占用。
- 瀑布流布局不再展示文件名，文件名会在大图模式下显示。
- 大图预览：支持鼠标滚轮缩放、拖拽平移、双击快速放大/还原。
- 全屏预览：点击“全屏”按钮或按 F 键在全屏/窗口模式间切换。
- 导航方式：移动到两侧即出现切换按钮，也可使用键盘左右方向键浏览，Delete/Delete 键直接删除当前图片，Esc 关闭预览。
- 删除仅在预览模式下提供（按钮或 Delete 键），操作立即生效且无确认弹窗，请谨慎使用。
