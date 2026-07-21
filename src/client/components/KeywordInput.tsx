interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function KeywordInput({ value, onChange }: Props) {
  return (
    <div className="keyword-input">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Highlight keywords, comma separated (e.g. silent hill, deus ex)"
      />
    </div>
  );
}
