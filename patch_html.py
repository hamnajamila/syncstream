import os
import re

def inline_assets():
    dist_path = 'dist'
    html_path = os.path.join(dist_path, 'index.html')
    
    if not os.path.exists(html_path):
        print("Error: index.html not found")
        return

    with open(html_path, 'r', encoding='utf-8') as f:
        html = f.read()

    # Find the JS file
    assets_path = os.path.join(dist_path, 'assets')
    js_file = None
    css_file = None
    
    if os.path.exists(assets_path):
        for f in os.listdir(assets_path):
            if f.endswith('.js') and 'index' in f:
                js_file = f
            if f.endswith('.css') and 'index' in f:
                css_file = f

    if not js_file:
        print("Error: No JS bundle found")
        return

    # Read JS
    with open(os.path.join(assets_path, js_file), 'r', encoding='utf-8') as f:
        js_code = f.read()
    
    # Read CSS
    css_code = ""
    if css_file:
        with open(os.path.join(assets_path, css_file), 'r', encoding='utf-8') as f:
            css_code = f.read()

    # Create the single-file HTML
    html = re.sub(r'<script[^>]*src="[^"]*"[^>]*></script>', '', html)
    html = re.sub(r'<link[^>]*rel="stylesheet"[^>]*>', '', html)
    html = re.sub(r'<link[^>]*rel="modulepreload"[^>]*>', '', html)

    # Inject CSS
    if css_code:
        html = html.replace('</head>', f'<style>{css_code}</style></head>')

    # Inject JS
    html = html.replace('</body>', f'<script>{js_code}</script></body>')

    # Final cleaning
    html = html.replace('type="module"', '')
    html = html.replace('crossorigin', '')
    
    # Error Logger with CORRECT ID 'diag'
    error_logger = """
    <script>
    window.onerror = function(msg, url, lineNo) {
        var d = document.getElementById('diag');
        if(d){ d.style.background='#EF4444'; d.innerText='JS ERROR: '+msg+' L'+lineNo; }
    };
    </script>
    """
    html = html.replace('<head>', f'<head>{error_logger}')

    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html)
    
    print(f"Patched index.html with ES5 code and correct diagnostic ID")

if __name__ == "__main__":
    inline_assets()
