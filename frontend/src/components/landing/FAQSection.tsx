import { FaqAccordionItem } from './FaqAccordionItem';

const FAQ_ITEMS = [
  {
    question: 'What art styles can I use?',
    answer: 'Manga (B&W lineart with screentone shading), Webtoon (Korean manhwa, flat vivid colors), Chibi (super-deformed, pastel kawaii), and Watercolor (soft brushstrokes, painterly).',
  },
  {
    question: 'How do characters stay consistent across panels?',
    answer: 'Upload one reference photo and IP-Adapter reference injection keeps your character visually consistent in every panel, no re-describing needed.',
  },
  {
    question: 'What can I export my comic as?',
    answer: 'A ZIP of PNGs, a CBZ archive, a PDF (with a 300 DPI print-ready option), or an EPUB.',
  },
  {
    question: "What's the difference between Full Page and Panel by Panel generation?",
    answer: 'Full Page generates one composite image per page with the AI arranging all panels in a manga layout — it\'s faster. Panel by Panel generates one image per panel, giving you full control over layout, framing, and lets you regenerate each panel individually.',
  },
  {
    question: 'Is it free to try?',
    answer: 'Yes — the Free tier is built for beginners. Paid tiers (Hobby, Pro) add higher page limits, character consistency, no watermark, and higher-resolution export. See the pricing page for details.',
  },
];

export function FAQSection() {
  return (
    <section className="relative z-10 bg-surface px-6 py-20 md:px-12">
      <div className="mx-auto" style={{ maxWidth: 1100 }}>
        <h2 className="mb-10 text-4xl font-black tracking-tight text-on-surface md:text-6xl">Questions</h2>
        <div className="flex flex-col gap-4">
          {FAQ_ITEMS.map(({ question, answer }) => (
            <FaqAccordionItem key={question} question={question} answer={answer} />
          ))}
        </div>
      </div>
    </section>
  );
}
