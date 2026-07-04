import StudioSidebar from '@/components/StudioSidebar'
import StudioTopBar from '@/components/StudioTopBar'
import { ComicEditor } from '@/components/ComicEditor'
import { ComicGenerationProvider } from '@/context/ComicGenerationContext'

interface Props {
  searchParams: Promise<{ project?: string; title?: string }>
}

export default async function EditorPage({ searchParams }: Props) {
  const params = await searchParams
  const initialProjectId = params.project ?? null
  const initialTitle     = params.title    ?? null

  return (
    <ComicGenerationProvider>
      <div className="min-h-screen bg-surface text-on-surface">
        <StudioSidebar />
        <StudioTopBar />
        <ComicEditor initialProjectId={initialProjectId} initialTitle={initialTitle} />
      </div>
    </ComicGenerationProvider>
  )
}
