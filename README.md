# SyncStream 🚀

**The Ultimate AI-Powered Task & Deadline Manager for Mobile.**

SyncStream is a premium, local-first productivity application designed for students and professionals who need to turn messy notes into organized, actionable tasks instantly. Built with a focus on mobile ergonomics and AI-driven efficiency.

![SyncStream Mobile Preview](https://raw.githubusercontent.com/hamnajamila/syncstream/master/public/preview.png)

## ✨ Features

- **AI-Powered Extraction**: Paste messy notes, bullet points, or raw thoughts. SyncStream uses Google Gemini 1.5 Flash to identify tasks, deadlines, and priorities automatically.
- **Smart Local Parsing**: No internet? No problem. The app features a built-in regex-based smart parser that recognizes dates and priorities locally.
- **Bulk Management**: Tap tasks to enter selection mode. Delete multiple tasks at once with ease.
- **Dynamic Priorities**: Automatic urgency calculation. Tasks due within 24 hours are elevated to **URGENT** priority to keep you focused.
- **Privacy First**: Your data stays on your device. SyncStream uses encrypted local storage with no external database requirements.
- **Mobile Native Experience**: Fully optimized for mobile screens with notch-friendly layouts, touch-optimized targets, and smooth Framer Motion animations.

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS v4 (Modern Design System)
- **AI**: Google Gemini 1.5 Flash API
- **Mobile**: Capacitor (Cross-platform Native Bridge)
- **Animations**: Framer Motion
- **Icons**: Lucide React

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- Android Studio (for mobile deployment)
- A Google Gemini API Key

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/hamnajamila/syncstream.git
   cd syncstream
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   Create a `.env` file in the root directory:
   ```env
   VITE_GEMINI_API_KEY=your_api_key_here
   ```

4. **Run in Browser:**
   ```bash
   npm run dev
   ```

### Mobile Deployment (Android)

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Sync with Capacitor:**
   ```bash
   npx cap sync android
   ```

3. **Open in Android Studio:**
   ```bash
   npx cap open android
   ```

## 🔒 Security & Privacy

SyncStream is designed with privacy as a core principle:
- **Zero Cloud Data**: We do not store your tasks on any server.
- **API Security**: Your Gemini API key is stored locally in your environment variables and never exposed in the public repository.
- **Local Persistence**: Data is stored in the device's `localStorage` and stays there unless the app is uninstalled.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---
Built with ❤️ by [Hamna Jamila](https://github.com/hamnajamila)
