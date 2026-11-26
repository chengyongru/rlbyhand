import { useEffect, useState } from 'react';
import { ChalkArrow, RoughStrokeSvg } from '../components/ChalkPrimitives';
import HomeIntro from './home.mdx';
import { ALL_CHAPTERS, BLOG_CHAPTERS, IS_DEV_PREVIEW, PLANNED_CHAPTERS } from './index';
import { CHALK_COLORS } from './types';

function readRouteId(): string | null {
  const raw = window.location.hash.replace(/^#\/?/, '').trim();
  return raw.length > 0 ? raw : null;
}

export function BlogReader() {
  const [routeId, setRouteId] = useState<string | null>(() => readRouteId());
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const onHashChange = () => {
      setRouteId(readRouteId());
      window.scrollTo({ top: 0, behavior: 'auto' });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const chapterIdx = routeId ? BLOG_CHAPTERS.findIndex((c) => c.id === routeId) : -1;
  const activeChapter = chapterIdx >= 0 ? BLOG_CHAPTERS[chapterIdx] : null;
  const prevChapter = chapterIdx > 0 ? BLOG_CHAPTERS[chapterIdx - 1] : null;
  const nextChapter =
    chapterIdx >= 0 && chapterIdx < BLOG_CHAPTERS.length - 1
      ? BLOG_CHAPTERS[chapterIdx + 1]
      : null;

  useEffect(() => {
    document.title = activeChapter ? activeChapter.title : 'rlbyhand';
  }, [activeChapter]);

  useEffect(() => {
    if (!activeChapter) {
      setScrollProgress(0);
      return;
    }

    let rafId = 0;
    const update = () => {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const ratio = Math.max(0, Math.min(1, window.scrollY / maxScroll));
      setScrollProgress(ratio);
    };

    const onScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        update();
      });
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [activeChapter]);

  if (!activeChapter) {
    return (
      <div className="chalkboard-stage" style={{ minHeight: '100vh', width: '100%' }}>
        <main className="toc-container">
          <header className="toc-header">
            <h1 className="chalk-title toc-title">rlbyhand</h1>
            <RoughStrokeSvg
              width={210}
              height={14}
              draw={(rc, svg) => {
                svg.appendChild(
                  rc.line(4, 7, 204, 6, {
                    stroke: CHALK_COLORS.yellow,
                    strokeWidth: 2.2,
                    roughness: 2.0,
                    bowing: 1.5,
                    seed: 901,
                  })
                );
              }}
            />
            <div className="toc-subtitle">
              <HomeIntro />
            </div>
          </header>

          <nav className="toc-list" aria-label="目录">
            {ALL_CHAPTERS.map((chapter) =>
              chapter.published || IS_DEV_PREVIEW ? (
                <a key={chapter.id} href={`#/${chapter.id}`} className="toc-item">
                  <span className="toc-num">{chapter.number}</span>
                  <span className="chalk-title toc-name">{chapter.name}</span>
                  {!chapter.published && <span className="toc-status">WIP</span>}
                  <span className="toc-arrow" aria-hidden="true">
                    <ChalkArrow
                      width={38}
                      height={18}
                      color={CHALK_COLORS.yellow}
                      strokeWidth={1.9}
                      seed={910 + Number(chapter.number)}
                    />
                  </span>
                </a>
              ) : (
                <div key={chapter.id} className="toc-item toc-item-planned" aria-disabled="true">
                  <span className="toc-num">{chapter.number}</span>
                  <span className="chalk-title toc-name">***</span>
                  <span className="toc-status">WIP</span>
                </div>
              )
            )}
            {PLANNED_CHAPTERS.map((chapter) => (
              <div key={chapter.id} className="toc-item toc-item-planned" aria-disabled="true">
                <span className="toc-num">{chapter.number}</span>
                <span className="chalk-title toc-name">{chapter.name}</span>
                <span className="toc-status">WIP</span>
              </div>
            ))}
          </nav>
        </main>
      </div>
    );
  }

  const ChapterContent = activeChapter.Content;

  return (
    <div className="chalkboard-stage" style={{ minHeight: '100vh', width: '100%' }}>
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: 3,
          height: `${scrollProgress * 100}%`,
          backgroundColor: CHALK_COLORS.yellow,
          opacity: 0.7,
          zIndex: 50,
          pointerEvents: 'none',
          filter: 'url(#chalk-stroke-filter)',
        }}
      />

      <a href="#/" className="chapter-home-link">
        rlbyhand
      </a>

      <main className="blog-container">
        <article className="blog-prose">
          <ChapterContent />
        </article>

        <nav className="chapter-footer-nav" aria-label="章节跳转">
          {prevChapter ? (
            <a href={`#/${prevChapter.id}`} className="chapter-nav-link chapter-nav-prev">
              <span className="chalk-title chapter-nav-title">
                {prevChapter.number} {prevChapter.name}
              </span>
            </a>
          ) : (
            <span />
          )}

          {nextChapter ? (
            <a href={`#/${nextChapter.id}`} className="chapter-nav-link chapter-nav-next">
              <span className="chalk-title chapter-nav-title">
                <span>
                  {nextChapter.number} {nextChapter.name}
                </span>
                <ChalkArrow
                  width={38}
                  height={18}
                  color={CHALK_COLORS.yellow}
                  strokeWidth={2.0}
                  seed={950}
                />
              </span>
            </a>
          ) : (
            <span />
          )}
        </nav>
      </main>
    </div>
  );
}
