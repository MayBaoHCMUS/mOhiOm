interface StepLoaderProps {
  label?: string;
  words: [string, string, string, string];
}

export default function StepLoader({ label = 'Working', words }: StepLoaderProps) {
  const cycle = [...words, words[0]];

  return (
    <div className="step-loader" role="status" aria-label={`${label}…`}>
      <div className="loader">
        <p>{label}</p>
        <div className="words">
          {cycle.map((word, i) => (
            <span key={i} className="word">{word}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
