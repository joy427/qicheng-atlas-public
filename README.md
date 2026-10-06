# 企澄 Atlas · A股只读镜像

本仓库托管企澄 Atlas 面向中国大陆网络的纯静态只读镜像：

- GitHub Pages：<https://joy427.github.io/qicheng-atlas-public/>
- 全球完整版：<https://qicheng-atlas-pages.pages.dev/>（Cloudflare Pages 在中国大陆不可用）
- 收录 5,572 家 A 股上市公司目录。
- 发布 5,542 家公司的 61,080 条股东关系；选择公司时按需加载对应数据分片。

静态镜像不依赖 Cloudflare API，不要求登录，不包含 TuShare Token、导入密钥、Cloudflare 凭据、私有 API 配置或受限原始数据。

运行 `node scripts/build-static-data.mjs` 可从 `D:\game\qicheng-atlas\data` 重新生成公开数据文件。

