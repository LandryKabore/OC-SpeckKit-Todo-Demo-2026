const Utils = {
  setStore(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  getStore(key) {
    const value = localStorage.getItem(key);

    if (value === null) {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  },

  removeItem(key) {
    localStorage.removeItem(key);
  },

  getAuthErrorMessage(error, fallback) {
    if (error.response?.data?.message) {
      return error.response.data.message;
    }

    if (!error.response) {
      return "Cannot reach the server. Make sure the backend is running on port 3200.";
    }

    return fallback;
  },

  getUserDisplayName(user) {
    if (!user) {
      return "";
    }

    const parts = [user.fName, user.lName].filter(Boolean);
    return parts.length ? parts.join(" ") : user.username ?? "";
  },

  getUserGreetingName(user) {
    if (!user) {
      return "";
    }

    return user.fName?.trim() || user.username || "";
  },

  getTimeGreeting(date = new Date()) {
    const hour = date.getHours();

    if (hour < 12) {
      return "Good morning";
    }

    if (hour < 17) {
      return "Good afternoon";
    }

    return "Good evening";
  },
};

export default Utils;
