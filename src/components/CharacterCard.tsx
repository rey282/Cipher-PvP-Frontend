// src/components/CharacterCard.tsx
type Props = {
  name: string;
  winRate: number; // e.g. 0.58   (58 %)
  imageUrl?: string;
};

export default function CharacterCard({ name, winRate, imageUrl }: Props) {
  return (
    <article className="bg-white rounded shadow p-4 flex flex-col items-center">
      {imageUrl && (
        <img
          src={imageUrl}
          alt={name}
          className="w-24 h-24 object-contain mb-2"
        />
      )}
      <h2 className="font-semibold text-lg">{name}</h2>
      <p className="text-sm text-gray-600">
        Win rate: <span className="font-medium">{Math.round(winRate * 100)}%</span>
      </p>
    </article>
  );
}
