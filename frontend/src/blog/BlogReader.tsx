import { useEffect, useState } from 'react';
import { BLOG_CHAPTERS } from './index';
import { CHALK_COLORS } from './types';

export function BlogReader() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeChapterIdx, setActiveChapterIdx] = useState(0);

  useEffect(() => {
    let rafId = 0;
    const update = () => {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const ratio = Math.max(0, Math.min(1, window.scrollY / maxScroll));
      setScrollProgress(ratio);

      const sections = document.querySelectorAll<HTMLElement>('[data-chapter-idx]');
      let current = 0;
      sections.forEach((sec) => {
        const rect = sec.getBoundingClientRect();
        if (rect.top <= window.innerHeight * 0.35) {
          current = Number(sec.dataset.chapterIdx ?? 0);
        }
      });
      setActiveChapterIdx(current);
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
  }, []);

  const activeChapter = BLOG_CHAPTERS[activeChapterIdx] ?? BLOG_CHAPTERS[0];

  useEffect(() => {
    document.title = activeChapter.title;
  }, [activeChapter.title]);

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

      <main className="blog-container">
        {BLOG_CHAPTERS.map((chapter, idx) => {
          const ChapterContent = chapter.Content;
          return (
            <article
              key={chapter.id}
              data-chapter-idx={idx}
              className="blog-prose"
            >
              <ChapterContent />
            </article>
          );
        })}
      </main>
    </div>
  );
}
