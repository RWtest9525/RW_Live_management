# Play Store Scraper API & Super Admin Management System

A production-ready Python API backend with an integrated Super Admin Dashboard to manage client subscriptions, issue API keys, and enforce usage limits and expiration guards without paying for 3rd-party SaaS services.

---

## 🌟 Key Features

1. **SQLite / SQLAlchemy Database Schema (`ClientAPI`)**
   - Automatically tracks client name, API keys (UUID-based `sk_live_...`), plan type (`Monthly` / `Custom`), start date, expiry date, monthly request limits, requests used, and active status.
2. **Super Admin Dashboard (`/admin`)**
   - Beautiful, responsive Tailwind CSS interface.
   - Protected with **Basic HTTP Authentication**.
   - Real-time client stats overview (Total Clients, Active Keys, Total Requests Handled, Expired Keys).
   - Form to generate new API keys with custom limits & date pickers.
   - One-click actions:
     - **Renew Subscription**: Extends expiration by +30 days, resets request count to 0, and reactivates key.
     - **Pause / Resume Key**: Toggle API key active state.
     - **Delete Key**: Permanently removes key with safety confirmation.
3. **API Key Guard Middleware (`require_api_key`)**
   - Validates incoming header `X-API-KEY` or `?api_key=` parameter.
   - Returns **401 Unauthorized** for invalid keys.
   - Returns **402 Payment Required** with custom JSON message when expired.
   - Returns **403 Forbidden** when manually paused.
   - Returns **429 Too Many Requests** when the monthly request limit is reached.
   - Increments `requests_used` automatically upon successful API calls.
4. **Client Usage Check Endpoint (`/api/check-status`)**
   - Public endpoint allowing clients to check remaining API credits and valid until date.

---

## 🚀 Deployment Instructions

### Option A: PythonAnywhere (Recommended for WSGI)
1. Log in to [PythonAnywhere](https://www.pythonanywhere.com/).
2. Go to **Files** and paste the code into a file named `app.py`.
3. Open a **Bash Console** in PythonAnywhere and install dependencies:
   ```bash
   pip install Flask Flask-SQLAlchemy google-play-scraper
   ```
4. Go to the **Web** tab in PythonAnywhere:
   - Create a new Flask App (Python 3.x).
   - Point your WSGI configuration file to `app.py`.
   - Click **Reload** to publish your application.

### Option B: Hugging Face Spaces
1. Create a new Space on [Hugging Face](https://huggingface.co/new-space).
2. Choose **Docker** or **Gradio / Flask Blank Space**.
3. Upload `app.py` and `requirements.txt`.
4. In Space Environment Variables (Settings):
   - `ADMIN_USERNAME`: `your_admin_user`
   - `ADMIN_PASSWORD`: `your_strong_password`
   - `SECRET_KEY`: `random_secret_string`

---

## 🔐 Super Admin Dashboard Access

- **URL**: `https://your-domain.com/admin`
- **Default Credentials**:
  - **Username**: `admin`
  - **Password**: `admin123`
- *(Note: Change these defaults by setting environment variables `ADMIN_USERNAME` and `ADMIN_PASSWORD`)*

---

## 💻 Third-Party Client Integration Guide (Share with your Users)

Give your clients their generated API Key (e.g. `sk_live_abc123...`) and the following code snippets for their website or backend:

### 1. Check Key Status & Remaining Credits (`/api/check-status`)
Clients can test their key status and remaining requests:

#### cURL
```bash
curl -X GET "https://your-domain.com/api/check-status?key=sk_live_abc123..."
```

#### JavaScript (Fetch)
```javascript
fetch("https://your-domain.com/api/check-status", {
  headers: {
    "X-API-KEY": "sk_live_abc123..."
  }
})
.then(res => res.json())
.then(data => {
  console.log("Subscription Status:", data.status);
  console.log("Valid Until:", data.valid_until);
  console.log("Remaining Requests:", data.requests_remaining);
});
```

---

### 2. Scraping Play Store Reviews (`/api/reviews`)

#### JavaScript / Node.js Integration
```javascript
async function getPlayStoreReviews(appId, count = 10) {
  const apiKey = "sk_live_abc123..."; // Replace with your client API key

  try {
    const response = await fetch(`https://your-domain.com/api/reviews?app_id=${appId}&count=${count}`, {
      method: "GET",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json"
      }
    });

    const data = await response.json();

    if (response.status === 200) {
      console.log("Fetched Reviews:", data.reviews);
      return data.reviews;
    } else if (response.status === 402) {
      alert("Subscription Expired: " + data.message);
    } else if (response.status === 429) {
      alert("Rate Limit Exceeded: " + data.message);
    } else {
      console.error("API Error:", data.message);
    }
  } catch (err) {
    console.error("Network Error:", err);
  }
}

// Example usage
getPlayStoreReviews("com.instagram.android", 5);
```

#### Python Integration
```python
import requests

API_KEY = "sk_live_abc123..."
URL = "https://your-domain.com/api/reviews"

headers = {
    "X-API-KEY": API_KEY
}

params = {
    "app_id": "com.whatsapp",
    "count": 10
}

response = requests.get(URL, headers=headers, params=params)

if response.status_code == 200:
    data = response.json()
    print(f"Successfully retrieved {data['count']} reviews.")
    for review in data['reviews']:
        print(f"[{review['rating']}★] {review['user_name']}: {review['content']}")
elif response.status_code == 402:
    print("Subscription Expired:", response.json()["message"])
elif response.status_code == 429:
    print("Limit Reached:", response.json()["message"])
else:
    print("Error:", response.json())
```

---

## 📡 API Response Codes Summary

| HTTP Status | Reason | JSON Response Sample |
| :--- | :--- | :--- |
| **200 OK** | Valid Key | `{"status": "success", "count": 10, "reviews": [...]}` |
| **401 Unauthorized** | Missing / Invalid Key | `{"status": "unauthorized", "message": "Invalid API Key."}` |
| **402 Payment Required** | Expiry Date Passed | `{"status": "expired", "message": "Your monthly subscription has expired. Please pay..."}` |
| **403 Forbidden** | Key Paused | `{"status": "paused", "message": "Your API Key is currently paused..."}` |
| **429 Too Many Requests** | Request Limit Reached | `{"status": "limit_exhausted", "message": "Your API request limit has been reached..."}` |
