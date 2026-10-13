// fetch answered like the backend: an answer per method and path (query string left out), the requests kept

type Answer = { status?: number; body?: unknown } | ((body: unknown) => { status?: number; body?: unknown });

export interface FakeBackend {
  on(method: string, path: string, answer: Answer): void;
  requests: { method: string; path: string; body: unknown; authorization: string | null }[];
}

export function fakeBackend(): FakeBackend {
  const answers = new Map<string, Answer>();
  const backend: FakeBackend = {
    on: (method, path, answer) => answers.set(`${method} ${path}`, answer),
    requests: [],
  };
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    const { pathname } = new URL(url);
    const method = init.method ?? "GET";
    const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    const headers = (init.headers ?? {}) as Record<string, string>;
    backend.requests.push({ method, path: pathname, body, authorization: headers.Authorization ?? null });
    const answer = answers.get(`${method} ${pathname}`);
    if (!answer) {
      return new Response(JSON.stringify({ title: "Not Found", detail: `${method} ${pathname}` }), { status: 404 });
    }
    const { status = 200, body: answerBody } = typeof answer === "function" ? answer(body) : answer;
    return new Response(answerBody === undefined ? null : JSON.stringify(answerBody), { status });
  });
  return backend;
}
