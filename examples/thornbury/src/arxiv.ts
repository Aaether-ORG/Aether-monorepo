/**
 * Tiny arxiv API client. arxiv exposes Atom feeds at
 *   http://export.arxiv.org/api/query?search_query=...
 * No API key needed. Polite usage: 1 req per 3 seconds.
 */

export interface ArxivPaper {
  id: string;          // e.g. "2601.00001v1"
  title: string;
  abstract: string;
  authors: string[];
  url: string;         // arxiv abs URL
  published: string;   // ISO timestamp
}

export async function arxivSearch(query: string, max = 5): Promise<ArxivPaper[]> {
  const params = new URLSearchParams({
    search_query: `all:${query}`,
    start: '0',
    max_results: String(max),
    sortBy: 'relevance',
    sortOrder: 'descending',
  });
  const url = `https://export.arxiv.org/api/query?${params}`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'aether-thornbury/0.1 (research agent)' },
  });
  if (!r.ok) throw new Error(`arxiv HTTP ${r.status}`);
  const xml = await r.text();
  return parseArxivAtom(xml).slice(0, max);
}

/** Naive but dependency-free Atom parser. Just extracts what we need. */
function parseArxivAtom(xml: string): ArxivPaper[] {
  const entries: ArxivPaper[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let m: RegExpExecArray | null;
  while ((m = entryRegex.exec(xml)) !== null) {
    const block = m[1]!;
    const id = pick(block, /<id>([^<]+)<\/id>/) || '';
    const title = (pick(block, /<title>([\s\S]*?)<\/title>/) || '').trim().replace(/\s+/g, ' ');
    const abs = (pick(block, /<summary>([\s\S]*?)<\/summary>/) || '').trim().replace(/\s+/g, ' ');
    const published = pick(block, /<published>([^<]+)<\/published>/) || '';
    const authors: string[] = [];
    const authorRegex = /<author>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<\/author>/g;
    let am: RegExpExecArray | null;
    while ((am = authorRegex.exec(block)) !== null) authors.push(am[1]!);

    // arxiv id is the trailing slug, e.g. "https://arxiv.org/abs/2601.00001v1"
    const arxivId = id.replace(/^https?:\/\/arxiv\.org\/abs\//, '');
    entries.push({
      id: arxivId,
      title,
      abstract: abs,
      authors,
      url: id,
      published,
    });
  }
  return entries;
}

function pick(s: string, re: RegExp): string | undefined {
  const m = s.match(re);
  return m ? m[1] : undefined;
}

/**
 * Fetch the arxiv abstract page (HTML) and return the abstract text.
 * For richer scraping (PDF text), wire in an arxiv PDF parser later.
 */
export async function fetchArxivAbstract(paper: ArxivPaper): Promise<string> {
  // The atom feed already gave us the abstract. This wrapper exists so
  // callers can swap to a deeper fetch (full PDF, sections) later.
  return paper.abstract;
}
