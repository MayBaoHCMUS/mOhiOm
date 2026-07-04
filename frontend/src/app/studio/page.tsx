import TextToComicGenerator from '@/components/TextToComicGenerator';

interface Props {
  searchParams: Promise<{ project?: string }>;
}

export default async function StudioPage({ searchParams }: Props) {
  const params = await searchParams;
  const initialProjectId = params.project ?? null;
  return <TextToComicGenerator initialProjectId={initialProjectId} />;
}

