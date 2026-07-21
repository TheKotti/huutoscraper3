interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export function WordListInput({ value, onChange, placeholder }: Props) {
  return (
    <div className="word-list-input">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
