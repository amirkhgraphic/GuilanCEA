// Push Notifications Client-side JavaScript
class PushNotificationManager {
  constructor() {
    this.vapidPublicKey = null
    this.serviceWorkerRegistration = null
    this.isSupported = "serviceWorker" in navigator && "PushManager" in window
  }

  async init(vapidPublicKey) {
    if (!this.isSupported) {
      console.warn("Push notifications are not supported in this browser")
      return false
    }

    this.vapidPublicKey = vapidPublicKey

    try {
      // Register service worker
      this.serviceWorkerRegistration = await navigator.serviceWorker.register("/static/js/sw.js")
      console.log("Service Worker registered successfully")
      return true
    } catch (error) {
      console.error("Service Worker registration failed:", error)
      return false
    }
  }

  async requestPermission() {
    if (!this.isSupported) {
      return "not-supported"
    }

    const permission = await Notification.requestPermission()
    console.log("Notification permission:", permission)
    return permission
  }

  async subscribe() {
    if (!this.serviceWorkerRegistration) {
      throw new Error("Service Worker not registered")
    }

    try {
      const subscription = await this.serviceWorkerRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey),
      })

      console.log("Push subscription successful:", subscription)
      return subscription
    } catch (error) {
      console.error("Push subscription failed:", error)
      throw error
    }
  }

  async unsubscribe() {
    if (!this.serviceWorkerRegistration) {
      return false
    }

    try {
      const subscription = await this.serviceWorkerRegistration.pushManager.getSubscription()
      if (subscription) {
        await subscription.unsubscribe()
        console.log("Push unsubscription successful")
        return true
      }
      return false
    } catch (error) {
      console.error("Push unsubscription failed:", error)
      return false
    }
  }

  async getSubscription() {
    if (!this.serviceWorkerRegistration) {
      return null
    }

    try {
      return await this.serviceWorkerRegistration.pushManager.getSubscription()
    } catch (error) {
      console.error("Failed to get subscription:", error)
      return null
    }
  }

  async sendSubscriptionToServer(subscription, deviceType = "web") {
    try {
      const response = await fetch("/api/communications/push-devices/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify({
          device_token: JSON.stringify(subscription),
          device_type: deviceType,
        }),
      })

      if (response.ok) {
        console.log("Subscription sent to server successfully")
        return true
      } else {
        console.error("Failed to send subscription to server:", response.statusText)
        return false
      }
    } catch (error) {
      console.error("Error sending subscription to server:", error)
      return false
    }
  }

  async removeSubscriptionFromServer(subscription) {
    try {
      const response = await fetch("/api/communications/push-devices/", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify({
          device_token: JSON.stringify(subscription),
        }),
      })

      if (response.ok) {
        console.log("Subscription removed from server successfully")
        return true
      } else {
        console.error("Failed to remove subscription from server:", response.statusText)
        return false
      }
    } catch (error) {
      console.error("Error removing subscription from server:", error)
      return false
    }
  }

  urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  // Helper method to setup push notifications for authenticated users
  async setupPushNotifications(vapidPublicKey) {
    const initialized = await this.init(vapidPublicKey)
    if (!initialized) return false

    const permission = await this.requestPermission()
    if (permission !== "granted") {
      console.log("Push notification permission denied")
      return false
    }

    try {
      const subscription = await this.subscribe()
      const sent = await this.sendSubscriptionToServer(subscription)
      return sent
    } catch (error) {
      console.error("Failed to setup push notifications:", error)
      return false
    }
  }
}

// Global instance
window.pushNotificationManager = new PushNotificationManager()

// Auto-setup for authenticated users (call this after user login)
window.setupPushNotifications = async (vapidPublicKey) =>
  await window.pushNotificationManager.setupPushNotifications(vapidPublicKey)
