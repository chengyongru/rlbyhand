import http.server
import re
import socketserver
import sys
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

FRONTEND_DIR = Path(__file__).resolve().parent.parent
DIST_DIR = FRONTEND_DIR / "dist"
CHAPTERS_DIR = FRONTEND_DIR / "src" / "blog" / "chapters"


def get_published_ids() -> list[str]:
    ids: list[str] = []
    for p in sorted(CHAPTERS_DIR.glob("*.mdx")):
        text = p.read_text(encoding="utf-8")
        m = re.search(r"export\s+const\s+meta\s*=\s*\{([\s\S]*?)\}", text)
        if m and re.search(r"\bpublished\s*:\s*true\b", m.group(1)):
            ids.append(p.stem)
    return ids


def main() -> None:
    if not DIST_DIR.exists():
        print("dist/ not found. Run `npm run build` first.", file=sys.stderr)
        sys.exit(1)

    chapter_ids = get_published_ids()
    routes = ["/"] + [f"/#/{cid}" for cid in chapter_ids]

    class QuietHandler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(DIST_DIR), **kwargs)

        def log_message(self, *args):
            pass

    httpd = socketserver.TCPServer(("127.0.0.1", 0), QuietHandler)
    port = httpd.server_address[1]
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    failures: list[str] = []

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            for width, height in [(1440, 900), (768, 900)]:
                page = browser.new_page(viewport={"width": width, "height": height})
                page_errors: list[str] = []
                bad_responses: list[str] = []
                page.on("pageerror", lambda e: page_errors.append(str(e)))
                page.on(
                    "response",
                    lambda r: bad_responses.append(f"{r.status} {r.url}") if r.status >= 400 else None,
                )

                for route in routes:
                    page_errors.clear()
                    bad_responses.clear()
                    url = f"http://127.0.0.1:{port}{route}"
                    page.goto(url, wait_until="networkidle")
                    page.wait_for_timeout(450)

                    for err in page_errors:
                        failures.append(f"[{width}px {route}] pageerror: {err}")
                    for resp in bad_responses:
                        failures.append(f"[{width}px {route}] HTTP error: {resp}")

                    report = page.evaluate(
                        """() => {
                            const issues = [];
                            if (document.documentElement.scrollWidth > window.innerWidth + 1) {
                                issues.push(`horizontal overflow: scrollWidth=${document.documentElement.scrollWidth} > innerWidth=${window.innerWidth}`);
                            }
                            const mathmlCount = document.querySelectorAll('.katex-mathml').length;
                            if (mathmlCount > 0) {
                                issues.push(`found ${mathmlCount} .katex-mathml nodes (duplicate copy-paste risk)`);
                            }
                            document.querySelectorAll('.blog-prose pre').forEach((pre, preIdx) => {
                                if (pre.scrollWidth > pre.clientWidth + 1) {
                                    issues.push(`code block #${preIdx} has horizontal overflow (scrollWidth=${pre.scrollWidth} > clientWidth=${pre.clientWidth})`);
                                }
                            });
                            document.querySelectorAll('figure.blog-figure').forEach((fig, figIdx) => {
                                const figRect = fig.getBoundingClientRect();
                                if (figRect.right > window.innerWidth + 1) {
                                    issues.push(`figure #${figIdx} overflows viewport right edge`);
                                }
                                fig.querySelectorAll('*').forEach((el) => {
                                    const hasDirectText = Array.from(el.childNodes).some(
                                        (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim().length > 0
                                    );
                                    if (!hasDirectText) return;
                                    const ff = window.getComputedStyle(el).fontFamily || '';
                                    if (!/Patrick Hand|Long Cang/i.test(ff)) {
                                        issues.push(`figure #${figIdx} text "${el.textContent.trim().slice(0, 24)}" uses non-handwriting font (${ff})`);
                                    }
                                });
                                fig.querySelectorAll('svg').forEach((svg) => {
                                    const style = window.getComputedStyle(svg);
                                    if (style.position !== 'absolute') return;
                                    const parent = svg.parentElement;
                                    if (!parent) return;
                                    const svgRect = svg.getBoundingClientRect();
                                    const label = parent.querySelector('.chalk-title');
                                    if (!label) return;
                                    const labelRect = label.getBoundingClientRect();
                                    const fontSize = parseFloat(window.getComputedStyle(label).fontSize) || 24;
                                    if (labelRect.height > fontSize * 1.65) {
                                        issues.push(`figure #${figIdx} badge "${label.textContent?.trim()}" wrapped onto multiple lines (h=${Math.round(labelRect.height)}px, font=${fontSize}px)`);
                                    }
                                    if (
                                        labelRect.top < svgRect.top - 4 ||
                                        labelRect.bottom > svgRect.bottom + 4 ||
                                        labelRect.left < svgRect.left - 4 ||
                                        labelRect.right > svgRect.right + 4
                                    ) {
                                        issues.push(`figure #${figIdx} badge "${label.textContent?.trim()}" overflows its roughjs overlay`);
                                    }
                                });
                            });
                            return issues;
                        }"""
                    )
                    for item in report:
                        failures.append(f"[{width}px {route}] {item}")

                page.close()
            browser.close()
    finally:
        httpd.shutdown()

    if failures:
        print(f"\nrlbyhand layout check failed ({len(failures)} issue(s)):\n", file=sys.stderr)
        for item in failures:
            print(f"  - {item}", file=sys.stderr)
        sys.exit(1)

    print(f"rlbyhand layout check passed ({len(routes)} routes x 2 viewports, 0 layout/console/HTTP issues).")


if __name__ == "__main__":
    main()
