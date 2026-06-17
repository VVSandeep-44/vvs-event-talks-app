import os
import re
import time
import requests
import feedparser
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# In-memory cache for release notes
cache = {
    "data": None,
    "last_fetched": 0
}
CACHE_DURATION = 1800  # Cache for 30 minutes

def clean_html_tags(html_text):
    """Utility function to strip HTML tags for simple text representation."""
    if not html_text:
        return ""
    # Replace links with text (href) format for readability in tweet text
    html_text = re.sub(r'<a\s+[^>]*href="([^"]*)"[^>]*>(.*?)</a>', r'\2 (\1)', html_text)
    # Remove HTML tags
    clean = re.compile('<.*?>')
    text = re.sub(clean, '', html_text)
    # Decode common HTML entities
    text = text.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
    # Normalize whitespaces
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def parse_release_notes():
    """Fetches the XML feed and parses it into structured release note items."""
    try:
        response = requests.get(FEED_URL, timeout=15)
        response.raise_for_status()
        
        feed = feedparser.parse(response.content)
        
        all_updates = []
        
        for entry in feed.entries:
            date_str = entry.get('title', 'Unknown Date')
            updated_iso = entry.get('updated', '')
            entry_id = entry.get('id', '')
            original_link = entry.get('link', '')
            
            # Content can be under 'content' or 'summary'
            content_val = ""
            if 'content' in entry and len(entry['content']) > 0:
                content_val = entry['content'][0]['value']
            elif 'summary' in entry:
                content_val = entry['summary']
            
            # GCP release notes are organized by day, containing multiple updates separated by <h3>Category</h3>
            # e.g., <h3>Feature</h3> <p>...</p> <h3>Issue</h3> <p>...</p>
            pattern = re.compile(r'<h3>(.*?)</h3>', re.IGNORECASE)
            matches = list(pattern.finditer(content_val))
            
            if not matches:
                # Fallback if there are no <h3> tags
                clean_txt = clean_html_tags(content_val)
                all_updates.append({
                    "id": f"{entry_id}_0",
                    "date": date_str,
                    "updated_iso": updated_iso,
                    "category": "General",
                    "content_html": content_val,
                    "content_text": clean_txt,
                    "link": original_link
                })
                continue
                
            for i in range(len(matches)):
                start_match = matches[i]
                category = start_match.group(1).strip()
                
                # Determine the slice of HTML for this item
                start_idx = start_match.end()
                end_idx = matches[i+1].start() if i + 1 < len(matches) else len(content_val)
                
                item_html = content_val[start_idx:end_idx].strip()
                item_text = clean_html_tags(item_html)
                
                all_updates.append({
                    "id": f"{entry_id}_{i}",
                    "date": date_str,
                    "updated_iso": updated_iso,
                    "category": category,
                    "content_html": item_html,
                    "content_text": item_text,
                    "link": original_link
                })
                
        return {
            "success": True,
            "title": feed.feed.get('title', 'BigQuery Release Notes'),
            "updated": feed.feed.get('updated', ''),
            "count": len(all_updates),
            "updates": all_updates
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "updates": []
        }

def get_cached_or_fresh_notes(force_refresh=False):
    """Returns cached release notes or fetches new ones if cache expired."""
    current_time = time.time()
    
    if force_refresh or not cache["data"] or (current_time - cache["last_fetched"] > CACHE_DURATION):
        data = parse_release_notes()
        if data.get("success", False):
            cache["data"] = data
            cache["last_fetched"] = current_time
        elif cache["data"]:
            # Fallback to cache if request fails but we have old data
            return cache["data"]
        else:
            return data
            
    return cache["data"]

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    data = get_cached_or_fresh_notes(force_refresh=force_refresh)
    return jsonify(data)

if __name__ == '__main__':
    # Run server locally on port 5000
    app.run(host='127.0.0.1', port=5000, debug=True)
