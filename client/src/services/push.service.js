export const subscribeToNotifications = async () => {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    console.warn('Push notifications not supported');
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    const registration = await navigator.serviceWorker.ready;
    // In a real app, you would send this subscription to your backend
    console.log('Push subscription ready for strategist updates.');
    return true;
  }
  return false;
};

export const sendLocalNotification = async (title, body) => {
  const registration = await navigator.serviceWorker.ready;
  registration.showNotification(title, {
    body,
    icon: '/clearsight_icon_512.png',
    badge: '/clearsight_icon_512.png',
    vibrate: [200, 100, 200]
  });
};
