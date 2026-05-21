export const INDEX_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>AI 上游节点 - v0 Gateway</title>
  <style>
    :root {
      --bg: hsl(222 47% 6%);
      --card: hsl(222 32% 10%);
      --card-2: hsl(222 28% 13%);
      --border: hsl(222 20% 18%);
      --fg: hsl(210 40% 96%);
      --muted: hsl(215 16% 60%);
      --primary: hsl(221 83% 63%);
      --secondary: hsl(222 24% 15%);
      --green: #4ade80;
      --red: #f87171;
      --blue: #60a5fa;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: var(--bg); color: var(--fg);
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
      font-size: 14px; line-height: 1.55; }
    code, pre, .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    a { color: var(--blue); text-decoration: none; }
    header { position: sticky; top: 0; z-index: 10; background: rgba(15,18,28,0.7); backdrop-filter: blur(8px); border-bottom: 1px solid var(--border); }
    .container { max-width: 920px; margin: 0 auto; padding: 0 16px; }
    .header-row { height: 56px; display: flex; align-items: center; gap: 12px; }
    .logo { width: 24px; height: 24px; border-radius: 6px; background: var(--primary); display: inline-flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 13px; }
    .title { font-size: 13px; font-weight: 600; line-height: 1; }
    .subtitle { font-size: 12px; color: var(--muted); margin-top: 4px; line-height: 1; }
    .running { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); box-shadow: 0 0 0 0 rgba(74,222,128,0.6); animation: pulse 2s infinite; }
    @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(74,222,128,0.6); } 70% { box-shadow: 0 0 0 8px rgba(74,222,128,0); } 100% { box-shadow: 0 0 0 0 rgba(74,222,128,0); } }
    nav.tabs { border-bottom: 1px solid var(--border); background: rgba(20,24,36,0.5); }
    nav.tabs .tabbar { display: flex; gap: 0; }
    nav.tabs button { background: transparent; color: var(--muted); border: none; padding: 12px 16px; font: inherit; font-weight: 500; cursor: pointer;
      border-bottom: 2px solid transparent; transition: color .15s, border-color .15s; }
    nav.tabs button.active { color: var(--fg); border-bottom-color: var(--primary); }
    nav.tabs button:hover { color: var(--fg); }
    main { padding: 24px 0 48px; }
    h2 { font-size: 18px; margin: 0 0 4px; font-weight: 600; }
    h3 { font-size: 14px; margin: 0 0 8px; font-weight: 600; }
    p { margin: 0; color: var(--muted); }
    .card { border: 1px solid var(--border); background: var(--card); border-radius: 10px; padding: 18px; }
    .card + .card { margin-top: 16px; }
    .stack > * + * { margin-top: 12px; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .pill { display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 500; }
    .pill.ok { background: rgba(74,222,128,0.12); color: var(--green); }
    .pill.bad { background: rgba(248,113,113,0.12); color: var(--red); }
    .pill .pill-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .seg { border: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.02); border-radius: 8px; padding: 12px; }
    .seg + .seg { margin-top: 8px; }
    .seg-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .seg-name { display: flex; align-items: center; gap: 8px; font-weight: 500; color: var(--fg); }
    .tag { background: rgba(255,255,255,0.04); padding: 2px 6px; border-radius: 4px; font-size: 11px; color: var(--muted); }
    .seg-env { font-size: 11px; color: var(--muted); margin-top: 6px; }
    code.kbd { background: rgba(255,255,255,0.06); padding: 1px 5px; border-radius: 3px; font-size: 12px; color: var(--fg); }
    pre.block { background: rgba(255,255,255,0.04); border-radius: 6px; padding: 12px; overflow-x: auto; font-size: 12px; color: var(--fg); margin: 0; }
    .url-box { background: rgba(255,255,255,0.04); border-radius: 6px; padding: 10px 12px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    table th { text-align: left; font-size: 11px; text-transform: uppercase; color: var(--muted); padding: 8px 12px 8px 0; font-weight: 500; border-bottom: 1px solid var(--border); }
    table td { padding: 8px 12px 8px 0; border-bottom: 1px solid var(--border); vertical-align: top; }
    table tr:last-child td { border-bottom: none; }
    .method { display: inline-block; padding: 2px 6px; border-radius: 4px; font-family: ui-monospace, monospace; font-size: 11px; font-weight: 700; }
    .method.GET { background: rgba(96,165,250,0.12); color: var(--blue); }
    .method.ANY { background: rgba(161,161,170,0.18); color: #d4d4d8; }
    .err { border: 1px solid rgba(248,113,113,0.3); background: rgba(248,113,113,0.08); color: var(--red); padding: 10px 12px; border-radius: 8px; font-size: 13px; }
    ul.bullet { padding-left: 0; list-style: none; margin: 0; color: var(--muted); font-size: 12px; }
    ul.bullet li { margin: 4px 0; }
    .hide { display: none !important; }
    section + section { margin-top: 24px; }
  </style>
</head>
<body>
  <header>
    <div class="container header-row">
      <span class="logo">V0</span>
      <div>
        <div class="title">AI 上游节点</div>
        <div class="subtitle">v0.app AI Gateway</div>
      </div>
      <div class="running"><span class="dot"></span><span>运行中</span></div>
    </div>
  </header>

  <nav class="tabs">
    <div class="container">
      <div class="tabbar">
        <button data-tab="status" class="active">节点状态</button>
        <button data-tab="docs">接入文档</button>
      </div>
    </div>
  </nav>

  <main>
    <div class="container">
      <!-- STATUS TAB -->
      <div id="tab-status">
        <div class="stack" style="display: flex; flex-direction: column; gap: 16px;">
          <div>
            <h2>节点状态</h2>
            <p>本节点使用 <a href="https://v0.dev" target="_blank">v0.app AI Gateway</a> 作为统一上游，对外暴露 <code class="kbd">/modelfarm/{openai,anthropic,google,openrouter}</code> 路径。</p>
          </div>

          <div id="error-box" class="err hide"></div>

          <div class="card stack">
            <h3>节点基础地址</h3>
            <div class="url-box mono" id="base-url">—</div>
            <p style="font-size: 12px;">下游网关在配置代理池时，将此地址作为一条上游 URL 加入即可。</p>
          </div>

          <div class="card stack">
            <h3>v0 AI Gateway 配置</h3>
            <div class="row" id="gateway-key-row">
              <span style="color: var(--muted);">AI_GATEWAY_API_KEY</span>
              <span style="color: var(--muted); font-size: 12px;">加载中…</span>
            </div>
            <p style="font-size: 12px;">需要设置 <code class="kbd">AI_GATEWAY_API_KEY</code> 环境变量来连接 v0.app AI Gateway。</p>
          </div>

          <div class="card stack">
            <h3>访问认证</h3>
            <div class="row" id="proxy-key-row">
              <span style="color: var(--muted);">PROXY_API_KEY</span>
              <span style="color: var(--muted); font-size: 12px;">加载中…</span>
            </div>
            <p style="font-size: 12px;">若设置了环境变量 <code class="kbd">PROXY_API_KEY</code>，所有 <code class="kbd">/modelfarm/*</code> 请求都需通过 <code class="kbd">Authorization: Bearer …</code> 或 <code class="kbd">x-api-key: …</code> 携带该密钥；未设置时则节点开放访问。</p>
          </div>

          <div class="card stack">
            <div>
              <h3>上游通道状态</h3>
              <p style="font-size: 12px; margin-top: 4px;">所有通道都依赖 <code class="kbd">AI_GATEWAY_API_KEY</code> 环境变量。通过 v0.app AI Gateway 统一代理到各提供商。</p>
            </div>
            <div id="segments-list">
              <div style="color: var(--muted); font-size: 13px;">加载中…</div>
            </div>
          </div>

          <div class="card stack">
            <h3>关于本节点</h3>
            <ul class="bullet">
              <li>• 角色：反向代理池中的一个上游成员节点</li>
              <li>• 后端：v0.app Vercel AI Gateway (https://api.v0.dev)</li>
              <li>• 支持的提供商：OpenAI、Anthropic、Google Gemini 等</li>
              <li>• 支持 SSE 流式响应；请求/响应字节按原样转发</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- DOCS TAB -->
      <div id="tab-docs" class="hide">
        <div style="display: flex; flex-direction: column; gap: 24px;">
          <div>
            <h2>接入文档</h2>
            <p>本节点使用 v0.app AI Gateway 作为统一后端。下游网关把它作为代理池中的一条 URL，转发到对应的 <code class="kbd">/modelfarm/*</code> 路径即可。</p>
          </div>

          <section class="card stack">
            <h3>认证</h3>
            <p style="font-size: 13px;">若已设置 <code class="kbd">PROXY_API_KEY</code>，所有 <code class="kbd">/modelfarm/*</code> 请求都需通过下列任一请求头携带该密钥：</p>
            <pre class="block">Authorization: Bearer &lt;PROXY_API_KEY&gt;
x-api-key: &lt;PROXY_API_KEY&gt;</pre>
            <p style="font-size: 12px;">未设置该环境变量时节点开放访问。节点会用 v0 AI Gateway 的密钥替换该请求头后再转发。</p>
          </section>

          <section class="card stack">
            <h3>上游通道与转发规则</h3>
            <table>
              <thead><tr><th>外部路径</th><th>转发到</th><th>说明</th></tr></thead>
              <tbody>
                <tr><td class="mono" style="font-size: 12px;">/modelfarm/openai/*</td><td class="mono" style="font-size: 11px; color: var(--muted);">api.v0.dev/*</td><td style="font-size: 12px; color: var(--muted);">OpenAI 兼容接口</td></tr>
                <tr><td class="mono" style="font-size: 12px;">/modelfarm/anthropic/*</td><td class="mono" style="font-size: 11px; color: var(--muted);">api.v0.dev/*</td><td style="font-size: 12px; color: var(--muted);">Anthropic 接口</td></tr>
                <tr><td class="mono" style="font-size: 12px;">/modelfarm/google/*</td><td class="mono" style="font-size: 11px; color: var(--muted);">api.v0.dev/*</td><td style="font-size: 12px; color: var(--muted);">Google Gemini 接口</td></tr>
                <tr><td class="mono" style="font-size: 12px;">/modelfarm/openrouter/*</td><td class="mono" style="font-size: 11px; color: var(--muted);">api.v0.dev/*</td><td style="font-size: 12px; color: var(--muted);">OpenRouter 兼容接口</td></tr>
              </tbody>
            </table>
            <p style="font-size: 12px;">请求方法、查询字符串、请求体（原始字节）与流式响应均按原样转发。</p>
          </section>

          <section class="card stack">
            <h3>在下游网关中加入本节点</h3>
            <p style="font-size: 13px;">在下游网关的"反向代理池"中新增一条上游：</p>
            <pre class="block" id="downstream-block">URL:    &lt;节点地址&gt;
API Key: &lt;本节点的 PROXY_API_KEY，留空则不认证&gt;</pre>
            <p style="font-size: 12px;">下游会把请求转发到形如 <code class="kbd" id="example-url">&lt;节点地址&gt;/modelfarm/openai/chat/completions</code> 的地址。</p>
          </section>

          <section class="card stack">
            <h3>直接调用示例</h3>
            <div>
              <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">OpenAI 兼容</p>
              <pre class="block" id="curl-openai"></pre>
            </div>
            <div>
              <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">Anthropic 原生</p>
              <pre class="block" id="curl-anthropic"></pre>
            </div>
          </section>

          <section class="card stack">
            <h3>管理接口</h3>
            <table>
              <thead><tr><th>方法</th><th>路径</th><th>说明</th></tr></thead>
              <tbody>
                <tr><td><span class="method GET">GET</span></td><td class="mono" style="font-size: 12px;">/api/healthz</td><td style="font-size: 12px; color: var(--muted);">健康检查</td></tr>
                <tr><td><span class="method GET">GET</span></td><td class="mono" style="font-size: 12px;">/api/setup-status</td><td style="font-size: 12px; color: var(--muted);">节点角色与 AI Gateway 配置状态</td></tr>
                <tr><td><span class="method ANY">ANY</span></td><td class="mono" style="font-size: 12px;">/modelfarm/&lt;segment&gt;/&lt;path&gt;</td><td style="font-size: 12px; color: var(--muted);">透传到 v0 AI Gateway</td></tr>
              </tbody>
            </table>
          </section>

          <section class="card stack">
            <h3>环境变量配置</h3>
            <table>
              <thead><tr><th>变量名</th><th>必填</th><th>说明</th></tr></thead>
              <tbody>
                <tr><td class="mono" style="font-size: 12px;">AI_GATEWAY_API_KEY</td><td style="font-size: 12px; color: var(--green);">是</td><td style="font-size: 12px; color: var(--muted);">v0.app AI Gateway 的 API Key</td></tr>
                <tr><td class="mono" style="font-size: 12px;">PROXY_API_KEY</td><td style="font-size: 12px; color: var(--muted);">否</td><td style="font-size: 12px; color: var(--muted);">客户端访问本节点的认证密钥</td></tr>
                <tr><td class="mono" style="font-size: 12px;">PORT</td><td style="font-size: 12px; color: var(--green);">是</td><td style="font-size: 12px; color: var(--muted);">服务监听端口</td></tr>
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </div>
  </main>

  <script>
    const SEGMENT_LABEL = { openai: "OpenAI", anthropic: "Anthropic", google: "Google Gemini", openrouter: "OpenRouter" };
    const baseUrl = window.location.origin;

    // Tabs
    const buttons = document.querySelectorAll("nav.tabs button");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => b.classList.toggle("active", b === btn));
        const tab = btn.dataset.tab;
        document.getElementById("tab-status").classList.toggle("hide", tab !== "status");
        document.getElementById("tab-docs").classList.toggle("hide", tab !== "docs");
      });
    });

    // Fill base URL & docs interpolations
    document.getElementById("base-url").textContent = baseUrl;
    document.getElementById("downstream-block").textContent =
      "URL:    " + baseUrl + "\\n" +
      "API Key: <本节点的 PROXY_API_KEY，留空则不认证>";
    document.getElementById("example-url").textContent = baseUrl + "/modelfarm/openai/chat/completions";
    document.getElementById("curl-openai").textContent =
      "curl " + baseUrl + "/modelfarm/openai/chat/completions \\\\\\n" +
      "  -H \\"Authorization: Bearer <PROXY_API_KEY>\\" \\\\\\n" +
      "  -H \\"Content-Type: application/json\\" \\\\\\n" +
      "  -d '{\\n" +
      "    \\"model\\": \\"gpt-4.1-mini\\",\\n" +
      "    \\"messages\\": [{\\"role\\":\\"user\\",\\"content\\":\\"你好\\"}]\\n" +
      "  }'";
    document.getElementById("curl-anthropic").textContent =
      "curl " + baseUrl + "/modelfarm/anthropic/v1/messages \\\\\\n" +
      "  -H \\"x-api-key: <PROXY_API_KEY>\\" \\\\\\n" +
      "  -H \\"Content-Type: application/json\\" \\\\\\n" +
      "  -d '{\\n" +
      "    \\"model\\": \\"claude-sonnet-4-5\\",\\n" +
      "    \\"max_tokens\\": 1024,\\n" +
      "    \\"messages\\": [{\\"role\\":\\"user\\",\\"content\\":\\"你好\\"}]\\n" +
      "  }'";

    // Pill helper
    function pill(ok, okText, badText) {
      const span = document.createElement("span");
      span.className = "pill " + (ok ? "ok" : "bad");
      const dot = document.createElement("span");
      dot.className = "pill-dot";
      span.appendChild(dot);
      span.appendChild(document.createTextNode(ok ? okText : badText));
      return span;
    }

    // Fetch status
    fetch("/api/setup-status")
      .then((r) => r.ok ? r.json() : r.text().then((t) => Promise.reject(new Error(t))))
      .then((status) => {
        // Gateway key row
        const gatewayRow = document.getElementById("gateway-key-row");
        gatewayRow.innerHTML = "";
        const gatewayLabel = document.createElement("span");
        gatewayLabel.style.color = "var(--muted)";
        gatewayLabel.textContent = "AI_GATEWAY_API_KEY";
        gatewayRow.appendChild(gatewayLabel);
        gatewayRow.appendChild(pill(!!status.aiGatewayConfigured, "已配置", "未设置"));

        // Proxy key row
        const row = document.getElementById("proxy-key-row");
        row.innerHTML = "";
        const label = document.createElement("span");
        label.style.color = "var(--muted)";
        label.textContent = "PROXY_API_KEY";
        row.appendChild(label);
        row.appendChild(pill(!!status.proxyKey, "已配置", "未设置（开放访问）"));

        // Segments
        const list = document.getElementById("segments-list");
        list.innerHTML = "";
        for (const s of status.segments) {
          const seg = document.createElement("div");
          seg.className = "seg";
          const head = document.createElement("div");
          head.className = "seg-head";
          const name = document.createElement("div");
          name.className = "seg-name";
          const nameText = document.createElement("span");
          nameText.textContent = SEGMENT_LABEL[s.segment] || s.segment;
          const tag = document.createElement("code");
          tag.className = "tag mono";
          tag.textContent = "/modelfarm/" + s.segment;
          name.appendChild(nameText);
          name.appendChild(tag);
          head.appendChild(name);
          head.appendChild(pill(!!s.configured, "可用", "需要配置 AI_GATEWAY_API_KEY"));
          seg.appendChild(head);
          const env = document.createElement("div");
          env.className = "seg-env mono";
          env.textContent = "通过 v0.app AI Gateway (api.v0.dev) 代理";
          seg.appendChild(env);
          list.appendChild(seg);
        }
      })
      .catch((e) => {
        const box = document.getElementById("error-box");
        box.classList.remove("hide");
        box.textContent = String(e && e.message ? e.message : e);
      });
  </script>
</body>
</html>`;
