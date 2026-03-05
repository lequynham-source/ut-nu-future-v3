class RequestQueue {
  private queue: (() => Promise<void>)[] = [];
  private activeCount = 0;
  private maxConcurrent = 2;

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeCount--;
          this.next();
        }
      });
      this.next();
    });
  }

  private next() {
    if (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        this.activeCount++;
        task();
      }
    }
  }
}

const apiQueue = new RequestQueue();

export async function apiFetch(url: string, options?: RequestInit, retries = 5): Promise<any> {
  return apiQueue.add(() => doFetch(url, options, retries));
}

let ws: WebSocket | null = null;
let wsListeners: ((data: any) => void)[] = [];

export function connectWebSocket(userId: number, user: any) {
  if (ws) return;

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  ws = new WebSocket(`${protocol}//${host}`);

  ws.onopen = () => {
    console.log('WebSocket connected');
    ws?.send(JSON.stringify({ type: 'auth', userId, user }));
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      wsListeners.forEach(listener => listener(data));
    } catch (e) {
      console.error('WS Message Error:', e);
    }
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected, retrying...');
    ws = null;
    setTimeout(() => connectWebSocket(userId, user), 5000);
  };
}

export function sendWSMessage(type: string, data: any) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, ...data }));
  }
}

export function addWSListener(listener: (data: any) => void) {
  wsListeners.push(listener);
  return () => {
    wsListeners = wsListeners.filter(l => l !== listener);
  };
}

async function doFetch(url: string, options?: RequestInit, retries = 5): Promise<any> {
  const initialRetries = 5;
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type');
    
    if (res.status === 429 && retries > 0) {
      const delay = Math.pow(2, initialRetries - retries) * 1000 + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      return doFetch(url, options, retries - 1);
    }

    if (contentType && contentType.includes('application/json')) {
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Lỗi ${res.status}: ${res.statusText}`);
      }
      return data;
    } else {
      const text = await res.text();
      
      // Retry if server is starting or rate limited
      const isStarting = text.includes('Starting Server') || text.includes('Service Unavailable');
      const isRateExceeded = text.includes('Rate exceeded');

      if ((isStarting || isRateExceeded) && retries > 0) {
        const delay = Math.pow(2, initialRetries - retries) * 1000 + Math.random() * 1000;
        console.log(`Server busy or starting, retrying in ${Math.round(delay)}ms... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return doFetch(url, options, retries - 1);
      }

      console.error('Non-JSON response received:', text.substring(0, 200));
      if (isRateExceeded) {
        throw new Error('Tần suất yêu cầu quá nhanh. Vui lòng đợi giây lát và thử lại.');
      }
      if (isStarting) {
        throw new Error('Máy chủ đang khởi động, vui lòng đợi vài giây và thử lại.');
      }
      throw new Error(`Máy chủ phản hồi không đúng định dạng (HTML thay vì JSON). Có thể do lỗi server hoặc sai đường dẫn.`);
    }
  } catch (error: any) {
    const isNetworkError = error.message === 'Failed to fetch' || error.name === 'TypeError';
    const isRateLimit = error.message?.includes('Rate exceeded') || error.message?.includes('Tần suất yêu cầu quá nhanh');
    
    if ((isNetworkError || isRateLimit) && retries > 0) {
      const delay = Math.pow(2, initialRetries - retries) * 1000 + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      return doFetch(url, options, retries - 1);
    }
    throw error;
  }
}
