import { contentOf, type Manifest, type PackBundle } from "./bundle";
import type { Content, Lesson } from "./schema";

/**
 * 화면이 콘텐츠를 얻는 유일한 통로. 파일 경로를 화면 코드에서 직접 import 하지 않는다.
 * 엔진(decideToday 등)은 이미 불러온 Content 를 인자로 받는 순수 함수 그대로다.
 */

export class ContentNotFoundError extends Error {
  constructor(what: string) {
    super(`콘텐츠를 찾을 수 없다: ${what}`);
    this.name = "ContentNotFoundError";
  }
}

export interface ContentRepository {
  getManifest(): Promise<Manifest>;
  getPack(packId: string): Promise<Content>;
  getLesson(packId: string, lessonId: string): Promise<Lesson>;
}

type FetchResponse = { ok: boolean; status: number; json(): Promise<unknown> };
export type FetchLike = (url: string) => Promise<FetchResponse>;

/** public/content (content:build 산출물)를 fetch 한다. 같은 요청은 한 번만 보내고 결과를 메모리에 둔다. */
export function createFetchRepository(opts: { baseUrl?: string; fetchImpl?: FetchLike } = {}): ContentRepository {
  const base = opts.baseUrl ?? "/content";
  const doFetch: FetchLike = opts.fetchImpl ?? ((url) => fetch(url));
  const cache = new Map<string, Promise<unknown>>();

  function once<T>(key: string, load: () => Promise<T>): Promise<T> {
    let p = cache.get(key) as Promise<T> | undefined;
    if (!p) {
      p = load().catch((e) => {
        cache.delete(key); // 실패는 기억하지 않는다 (네트워크가 돌아오면 다시 시도)
        throw e;
      });
      cache.set(key, p);
    }
    return p;
  }

  async function getJson<T>(url: string, what: string): Promise<T> {
    const res = await doFetch(url);
    if (res.status === 404) throw new ContentNotFoundError(what);
    if (!res.ok) throw new Error(`${what} 를 불러오지 못했다 (HTTP ${res.status})`);
    return (await res.json()) as T;
  }

  return {
    getManifest: () => once("manifest", () => getJson<Manifest>(`${base}/manifest.json`, "manifest")),
    getPack: (packId) =>
      once(`pack:${packId}`, async () => contentOf(await getJson<PackBundle>(`${base}/packs/${encodeURIComponent(packId)}.json`, `팩 ${packId}`))),
    async getLesson(packId, lessonId) {
      const content = await this.getPack(packId);
      const lesson = content.lessons.find((l) => l.id === lessonId);
      if (!lesson) throw new ContentNotFoundError(`레슨 ${lessonId}`);
      return lesson;
    },
  };
}

/** 앱 전체가 공유하는 저장소 (브라우저). */
export const contentRepository: ContentRepository = createFetchRepository();
