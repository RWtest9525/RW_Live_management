"""
Play Store Review Scraper API & Super Admin Subscription Dashboard
------------------------------------------------------------------
Self-contained Flask application with SQLite / SQLAlchemy database.
Deployable directly on PythonAnywhere, Hugging Face Spaces, Render, or any VPS.

Dependencies:
    pip install Flask Flask-SQLAlchemy google-play-scraper
"""

import os
import uuid
import functools
from datetime import datetime, timedelta
from flask import Flask, render_template_string, request, jsonify, redirect, url_for, flash, make_response

# ------------------------------------------------------------------------------
# CONFIGURATION & DATABASE INITIALIZATION
# ------------------------------------------------------------------------------
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'super-secret-key-change-this-in-prod')

# SQLite Database setup
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', f'sqlite:///{os.path.join(BASE_DIR, "clients.db")}')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

from flask_sqlalchemy import SQLAlchemy
db = SQLAlchemy(app)

# Super Admin Credentials (Change or set environment variables in production)
ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME', 'admin')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')


# ------------------------------------------------------------------------------
# 1. DATABASE SCHEMA (ClientAPI Table)
# ------------------------------------------------------------------------------
class ClientAPI(db.Model):
    __tablename__ = 'client_api'
    
    id = db.Column(db.Integer, primary_key=True)
    client_name = db.Column(db.String(100), nullable=False)
    api_key = db.Column(db.String(64), unique=True, nullable=False, default=lambda: f"sk_live_{uuid.uuid4().hex}")
    subscription_plan = db.Column(db.String(50), nullable=False, default='Monthly')  # 'Monthly' or 'Custom'
    start_date = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    expiry_date = db.Column(db.DateTime, nullable=False)
    request_limit = db.Column(db.Integer, nullable=False, default=5000)
    requests_used = db.Column(db.Integer, nullable=False, default=0)
    is_active = db.Column(db.Boolean, nullable=False, default=True)

    def to_dict(self):
        now = datetime.utcnow()
        is_expired = now > self.expiry_date
        return {
            "id": self.id,
            "client_name": self.client_name,
            "api_key": self.api_key,
            "subscription_plan": self.subscription_plan,
            "start_date": self.start_date.strftime("%Y-%m-%d"),
            "expiry_date": self.expiry_date.strftime("%Y-%m-%d"),
            "request_limit": self.request_limit,
            "requests_used": self.requests_used,
            "requests_remaining": max(0, self.request_limit - self.requests_used),
            "is_active": self.is_active and not is_expired,
            "is_expired": is_expired
        }

with app.app_context():
    db.create_all()


# ------------------------------------------------------------------------------
# SUPER ADMIN AUTHENTICATION HELPERS
# ------------------------------------------------------------------------------
def check_admin_auth(username, password):
    return username == ADMIN_USERNAME and password == ADMIN_PASSWORD

def admin_required(f):
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        auth = request.authorization
        if not auth or not check_admin_auth(auth.username, auth.password):
            return make_response(
                'Super Admin Access Required', 401,
                {'WWW-Authenticate': 'Basic realm="Super Admin Dashboard Required"'}
            )
        return f(*args, **kwargs)
    return decorated


# ------------------------------------------------------------------------------
# 3. API KEY VALIDATION MIDDLEWARE / DECORATOR
# ------------------------------------------------------------------------------
def require_api_key(f):
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        # 1. Read key from X-API-KEY header or query param
        api_key = request.headers.get('X-API-KEY') or request.args.get('api_key') or request.args.get('key')
        
        if not api_key:
            return jsonify({
                "status": "unauthorized",
                "message": "Missing API Key. Please provide header 'X-API-KEY'."
            }), 401
            
        client = ClientAPI.query.filter_by(api_key=api_key).first()
        
        # 2. Check if API Key exists
        if not client:
            return jsonify({
                "status": "unauthorized",
                "message": "Invalid API Key."
            }), 401
            
        now = datetime.utcnow()
        
        # 3. Check Expiry Date
        if now > client.expiry_date:
            if client.is_active:
                client.is_active = False
                db.session.commit()
            return jsonify({
                "status": "expired",
                "message": "Your monthly subscription has expired. Please pay the API Provider to renew your access."
            }), 402
            
        # 4. Check if Paused manually
        if not client.is_active:
            return jsonify({
                "status": "paused",
                "message": "Your API Key is currently paused or inactive. Contact provider to reactivate."
            }), 403
            
        # 5. Check Request Limit
        if client.requests_used >= client.request_limit:
            return jsonify({
                "status": "limit_exhausted",
                "message": "Your API request limit has been reached for this month. Contact provider to upgrade."
            }), 429
            
        # 6. Valid request -> Increment request counter & allow
        client.requests_used += 1
        db.session.commit()
        
        request.current_client = client
        return f(*args, **kwargs)
    return decorated


# ------------------------------------------------------------------------------
# 4. CLIENT USAGE CHECK ENDPOINT (Public)
# ------------------------------------------------------------------------------
@app.route('/api/check-status', methods=['GET'])
def check_status():
    api_key = request.headers.get('X-API-KEY') or request.args.get('key') or request.args.get('api_key')
    if not api_key:
        return jsonify({
            "status": "error",
            "message": "API key required via ?key= parameter or X-API-KEY header"
        }), 400

    client = ClientAPI.query.filter_by(api_key=api_key).first()
    if not client:
        return jsonify({
            "status": "error",
            "message": "Invalid API Key"
        }), 401

    now = datetime.utcnow()
    is_expired = now > client.expiry_date

    if is_expired:
        status_str = "expired"
    elif not client.is_active:
        status_str = "paused"
    elif client.requests_used >= client.request_limit:
        status_str = "limit_exhausted"
    else:
        status_str = "active"

    return jsonify({
        "status": status_str,
        "valid_until": client.expiry_date.strftime("%Y-%m-%d"),
        "requests_remaining": max(0, client.request_limit - client.requests_used),
        "requests_used": client.requests_used,
        "request_limit": client.request_limit,
        "subscription_plan": client.subscription_plan
    })


# ------------------------------------------------------------------------------
# PROTECTED SCRAPER ENDPOINT (/api/reviews)
# ------------------------------------------------------------------------------
@app.route('/api/reviews', methods=['GET'])
@require_api_key
def get_play_store_reviews():
    app_id = request.args.get('app_id', 'com.instagram.android')
    count = int(request.args.get('count', 10))
    count = min(max(1, count), 100) # Clamp count between 1 and 100

    try:
        from google_play_scraper import reviews, Sort
        result, _ = reviews(
            app_id,
            lang='en',
            country='us',
            sort=Sort.NEWEST,
            count=count
        )
        
        clean_reviews = []
        for r in result:
            clean_reviews.append({
                "review_id": r.get('reviewId'),
                "user_name": r.get('userName'),
                "user_image": r.get('userImage'),
                "rating": r.get('score'),
                "content": r.get('content'),
                "thumbs_up": r.get('thumbsUpCount'),
                "date": str(r.get('at'))
            })

        return jsonify({
            "status": "success",
            "app_id": app_id,
            "count": len(clean_reviews),
            "reviews": clean_reviews
        })
    except ImportError:
        # Structured fallback if google-play-scraper is not yet installed
        return jsonify({
            "status": "success",
            "app_id": app_id,
            "count": 2,
            "note": "Install google-play-scraper package (`pip install google-play-scraper`) for live Play Store data.",
            "reviews": [
                {
                    "review_id": "demo_001",
                    "user_name": "Alex Johnson",
                    "rating": 5,
                    "content": "Excellent app! Extremely useful features and quick performance.",
                    "thumbs_up": 12,
                    "date": "2026-07-30 15:20:00"
                },
                {
                    "review_id": "demo_002",
                    "user_name": "Maria Garcia",
                    "rating": 4,
                    "content": "Great experience overall. Looking forward to new updates.",
                    "thumbs_up": 4,
                    "date": "2026-07-29 10:15:00"
                }
            ]
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Failed to fetch Play Store reviews: {str(e)}"
        }), 500


# ------------------------------------------------------------------------------
# 2. SUPER ADMIN DASHBOARD UI & ACTIONS
# ------------------------------------------------------------------------------
ADMIN_HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Super Admin - Play Store Scraper API Management</title>
    <!-- Tailwind CSS CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- FontAwesome Icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; }
    </style>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen">
    
    <!-- Top Header -->
    <header class="bg-slate-800 border-b border-slate-700 py-4 px-6 sticky top-0 z-50">
        <div class="max-w-7xl mx-auto flex justify-between items-center">
            <div class="flex items-center space-x-3">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                    <i class="fa-solid fa-key"></i>
                </div>
                <div>
                    <h1 class="text-xl font-bold tracking-tight text-white">Scraper API Admin</h1>
                    <p class="text-xs text-slate-400">Play Store Review API Key & Client Subscription Manager</p>
                </div>
            </div>
            <div class="flex items-center space-x-4">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> System Active
                </span>
            </div>
        </div>
    </header>

    <main class="max-w-7xl mx-auto p-6 space-y-8">
        
        <!-- Metrics Stats Grid -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div class="bg-slate-800 border border-slate-700/60 p-5 rounded-2xl shadow-sm">
                <div class="flex items-center justify-between text-slate-400 mb-2">
                    <span class="text-sm font-medium">Total Clients</span>
                    <i class="fa-solid fa-users text-indigo-400"></i>
                </div>
                <div class="text-3xl font-bold text-white">{{ stats.total }}</div>
            </div>

            <div class="bg-slate-800 border border-slate-700/60 p-5 rounded-2xl shadow-sm">
                <div class="flex items-center justify-between text-slate-400 mb-2">
                    <span class="text-sm font-medium">Active Keys</span>
                    <i class="fa-solid fa-circle-check text-emerald-400"></i>
                </div>
                <div class="text-3xl font-bold text-emerald-400">{{ stats.active }}</div>
            </div>

            <div class="bg-slate-800 border border-slate-700/60 p-5 rounded-2xl shadow-sm">
                <div class="flex items-center justify-between text-slate-400 mb-2">
                    <span class="text-sm font-medium">Total Requests Used</span>
                    <i class="fa-solid fa-chart-line text-blue-400"></i>
                </div>
                <div class="text-3xl font-bold text-blue-400">{{ stats.total_requests }}</div>
            </div>

            <div class="bg-slate-800 border border-slate-700/60 p-5 rounded-2xl shadow-sm">
                <div class="flex items-center justify-between text-slate-400 mb-2">
                    <span class="text-sm font-medium">Expired / Paused</span>
                    <i class="fa-solid fa-triangle-exclamation text-amber-400"></i>
                </div>
                <div class="text-3xl font-bold text-amber-400">{{ stats.inactive }}</div>
            </div>
        </div>

        <!-- Main Layout: Form + Clients Table -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            <!-- Left Column: Generate New API Key Form -->
            <div class="bg-slate-800 border border-slate-700/60 rounded-2xl p-6 shadow-sm h-fit">
                <div class="flex items-center space-x-2 mb-6 pb-4 border-b border-slate-700">
                    <i class="fa-solid fa-plus-circle text-indigo-400 text-lg"></i>
                    <h2 class="text-lg font-bold text-white">Generate New API Key</h2>
                </div>

                <form action="/admin/generate-key" method="POST" class="space-y-5">
                    <div>
                        <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Client Name</label>
                        <input type="text" name="client_name" required placeholder="e.g. Acme Corp / John Doe" 
                            class="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition">
                    </div>

                    <div>
                        <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Subscription Plan</label>
                        <select name="subscription_plan" class="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition">
                            <option value="Monthly">Monthly Plan</option>
                            <option value="Custom">Custom Enterprise Plan</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Monthly Request Limit</label>
                        <input type="number" name="request_limit" value="5000" min="100" step="500" required 
                            class="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition">
                    </div>

                    <div>
                        <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Expiry Date</label>
                        <input type="date" name="expiry_date" value="{{ default_expiry }}" required 
                            class="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition">
                    </div>

                    <button type="submit" class="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-indigo-500/20 transition flex items-center justify-center space-x-2">
                        <i class="fa-solid fa-wand-magic-sparkles"></i>
                        <span>Generate API Key</span>
                    </button>
                </form>
            </div>

            <!-- Right Column: Active Clients List Table -->
            <div class="lg:col-span-2 bg-slate-800 border border-slate-700/60 rounded-2xl p-6 shadow-sm">
                <div class="flex items-center justify-between mb-6 pb-4 border-b border-slate-700">
                    <div class="flex items-center space-x-2">
                        <i class="fa-solid fa-list-check text-indigo-400 text-lg"></i>
                        <h2 class="text-lg font-bold text-white">Client Subscriptions & API Keys</h2>
                    </div>
                    <span class="text-xs text-slate-400">{{ clients|length }} Clients Total</span>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm text-slate-300">
                        <thead class="text-xs uppercase bg-slate-900/60 text-slate-400 border-b border-slate-700">
                            <tr>
                                <th class="py-3.5 px-4 font-semibold">Client</th>
                                <th class="py-3.5 px-4 font-semibold">API Key</th>
                                <th class="py-3.5 px-4 font-semibold">Usage Progress</th>
                                <th class="py-3.5 px-4 font-semibold">Expiry Date</th>
                                <th class="py-3.5 px-4 font-semibold text-center">Status</th>
                                <th class="py-3.5 px-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-700/60">
                            {% for c in clients %}
                            {% set pct = ((c.requests_used / c.request_limit) * 100)|round|int %}
                            <tr class="hover:bg-slate-700/30 transition">
                                <!-- Client Info -->
                                <td class="py-4 px-4 font-medium text-white">
                                    <div class="font-semibold text-white">{{ c.client_name }}</div>
                                    <span class="text-xs text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded">{{ c.subscription_plan }}</span>
                                </td>

                                <!-- API Key & Copy -->
                                <td class="py-4 px-4 font-mono text-xs">
                                    <div class="flex items-center space-x-1.5 bg-slate-900 border border-slate-700 px-2.5 py-1.5 rounded-lg w-fit">
                                        <span class="text-indigo-300 select-all">{{ c.api_key[:12] }}...{{ c.api_key[-4:] }}</span>
                                        <button onclick="copyToClipboard('{{ c.api_key }}')" title="Copy API Key" class="text-slate-400 hover:text-white transition ml-1">
                                            <i class="fa-regular fa-copy"></i>
                                        </button>
                                    </div>
                                </td>

                                <!-- Usage Bar -->
                                <td class="py-4 px-4 min-w-[160px]">
                                    <div class="flex justify-between text-xs font-semibold mb-1">
                                        <span>{{ c.requests_used }} / {{ c.request_limit }}</span>
                                        <span class="{% if pct >= 100 %}text-red-400{% elif pct >= 80 %}text-amber-400{% else %}text-emerald-400{% endif %}">{{ pct }}%</span>
                                    </div>
                                    <div class="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700">
                                        <div class="h-2 rounded-full transition-all duration-500 {% if pct >= 100 %}bg-red-500{% elif pct >= 80 %}bg-amber-500{% else %}bg-gradient-to-r from-indigo-500 to-emerald-400{% endif %}" 
                                             style="width: {{ [pct, 100]|min }}%"></div>
                                    </div>
                                </td>

                                <!-- Expiry Date -->
                                <td class="py-4 px-4 text-xs">
                                    <div class="font-medium text-slate-200">{{ c.expiry_date.strftime('%Y-%m-%d') }}</div>
                                    <div class="text-slate-400 text-[10px]">Start: {{ c.start_date.strftime('%Y-%m-%d') }}</div>
                                </td>

                                <!-- Status Badge -->
                                <td class="py-4 px-4 text-center">
                                    {% if c.is_expired %}
                                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                                            Expired
                                        </span>
                                    {% elif not c.is_active %}
                                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                            Paused
                                        </span>
                                    {% elif c.requests_used >= c.request_limit %}
                                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                            Exhausted
                                        </span>
                                    {% else %}
                                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                            Active
                                        </span>
                                    {% endif %}
                                </td>

                                <!-- Action Buttons -->
                                <td class="py-4 px-4 text-right">
                                    <div class="flex items-center justify-end space-x-2">
                                        <!-- Renew 30 Days -->
                                        <form action="/admin/renew/{{ c.id }}" method="POST" inline>
                                            <button type="submit" title="Renew for +30 Days & Reset Usage" class="p-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg transition text-xs font-medium border border-emerald-500/30 flex items-center space-x-1">
                                                <i class="fa-solid fa-arrows-rotate"></i>
                                                <span class="hidden sm:inline">Renew</span>
                                            </button>
                                        </form>

                                        <!-- Pause / Resume -->
                                        <form action="/admin/toggle-pause/{{ c.id }}" method="POST" inline>
                                            <button type="submit" title="{{ 'Resume Key' if not c.is_active else 'Pause Key' }}" class="p-2 bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white rounded-lg transition text-xs font-medium border border-amber-500/30">
                                                <i class="fa-solid {{ 'fa-play' if not c.is_active else 'fa-pause' }}"></i>
                                            </button>
                                        </form>

                                        <!-- Delete Key -->
                                        <form action="/admin/delete/{{ c.id }}" method="POST" onsubmit="return confirm('Are you sure you want to delete API Key for {{ c.client_name }}?');" inline>
                                            <button type="submit" title="Delete API Key" class="p-2 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg transition text-xs border border-red-500/30">
                                                <i class="fa-solid fa-trash"></i>
                                            </button>
                                        </form>
                                    </div>
                                </td>
                            </tr>
                            {% else %}
                            <tr>
                                <td colspan="6" class="py-8 text-center text-slate-500">
                                    <i class="fa-solid fa-folder-open text-3xl mb-2 block"></i>
                                    No API Keys generated yet. Create one using the form on the left.
                                </td>
                            </tr>
                            {% endfor %}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    </main>

    <script>
        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                alert("API Key copied to clipboard!");
            });
        }
    </script>
</body>
</html>
"""

@app.route('/admin', methods=['GET'])
@admin_required
def admin_dashboard():
    clients = ClientAPI.query.order_by(ClientAPI.id.desc()).all()
    now = datetime.utcnow()
    
    # Update status for display objects
    clients_formatted = []
    total_reqs = 0
    active_count = 0
    inactive_count = 0

    for c in clients:
        c.is_expired = now > c.expiry_date
        total_reqs += c.requests_used
        if c.is_active and not c.is_expired and c.requests_used < c.request_limit:
            active_count += 1
        else:
            inactive_count += 1
        clients_formatted.append(c)

    stats = {
        "total": len(clients),
        "active": active_count,
        "inactive": inactive_count,
        "total_requests": total_reqs
    }

    default_expiry = (now + timedelta(days=30)).strftime("%Y-%m-%d")
    return render_template_string(ADMIN_HTML_TEMPLATE, clients=clients_formatted, stats=stats, default_expiry=default_expiry)


@app.route('/admin/generate-key', methods=['POST'])
@admin_required
def generate_key():
    client_name = request.form.get('client_name')
    subscription_plan = request.form.get('subscription_plan', 'Monthly')
    request_limit = int(request.form.get('request_limit', 5000))
    expiry_date_str = request.form.get('expiry_date')
    
    expiry_date = datetime.strptime(expiry_date_str, "%Y-%m-%d")

    new_client = ClientAPI(
        client_name=client_name,
        subscription_plan=subscription_plan,
        request_limit=request_limit,
        expiry_date=expiry_date,
        start_date=datetime.utcnow(),
        requests_used=0,
        is_active=True
    )
    db.session.add(new_client)
    db.session.commit()

    return redirect(url_for('admin_dashboard'))


@app.route('/admin/renew/<int:client_id>', methods=['POST'])
@admin_required
def renew_client(client_id):
    client = ClientAPI.query.get_or_404(client_id)
    now = datetime.utcnow()
    
    # Extend by 30 days from today (or existing expiry if in future)
    base_date = max(now, client.expiry_date)
    client.expiry_date = base_date + timedelta(days=30)
    client.requests_used = 0
    client.is_active = True
    
    db.session.commit()
    return redirect(url_for('admin_dashboard'))


@app.route('/admin/toggle-pause/<int:client_id>', methods=['POST'])
@admin_required
def toggle_pause(client_id):
    client = ClientAPI.query.get_or_404(client_id)
    client.is_active = not client.is_active
    db.session.commit()
    return redirect(url_for('admin_dashboard'))


@app.route('/admin/delete/<int:client_id>', methods=['POST'])
@admin_required
def delete_key(client_id):
    client = ClientAPI.query.get_or_404(client_id)
    db.session.delete(client)
    db.session.commit()
    return redirect(url_for('admin_dashboard'))


# ------------------------------------------------------------------------------
# APP RUNNER (For Local Testing & Production WSGI)
# ------------------------------------------------------------------------------
if __name__ == '__main__':
    print("Starting Play Store Review Scraper API & Super Admin Dashboard...")
    print("Access Admin Dashboard at: http://localhost:5000/admin (Default Auth: admin / admin123)")
    print("Scraper API Endpoint: http://localhost:5000/api/reviews?app_id=com.instagram.android")
    print("Status Check Endpoint: http://localhost:5000/api/check-status?key=YOUR_API_KEY")
    app.run(host='0.0.0.0', port=5000, debug=True)
