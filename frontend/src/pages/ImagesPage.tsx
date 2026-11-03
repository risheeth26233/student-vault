import { useState } from 'react';
import { useGenerateImage, useImagesStatus } from '../hooks/useImages';
import { Button } from '../components/ui/Button';

export function ImagesPage() {
  const [prompt, setPrompt] = useState('');
  const [consent, setConsent] = useState(false);
  const status = useImagesStatus();
  const generate = useGenerateImage();
  return <section className="space-y-6 p-6">
    <h1 className="text-3xl font-bold">Educational images</h1>
    <p>Describe a diagram or illustration. Generated labels and scientific details may be inaccurate; verify them before studying.</p>
    {status.isPending && <p role="status">Checking image service…</p>}
    {status.isError && <div role="alert">Could not check the service. <button onClick={() => void status.refetch()}>Retry</button></div>}
    {status.data && !status.data.configured && <p role="status">Image generation is unavailable. You can still upload your own diagrams in Documents.</p>}
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (consent && prompt.trim()) generate.mutate({ prompt: prompt.trim(), width: 512, height: 512, format: 'png' }); }}>
      <label className="block">Image description<textarea className="block w-full rounded border p-3" value={prompt} onChange={event => setPrompt(event.target.value)} maxLength={2000} required rows={4} /></label>
      <label className="flex gap-2"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />Send this description to the configured image provider. Provider usage may incur charges.</label>
      <Button type="submit" disabled={!consent || !prompt.trim() || !status.data?.configured || generate.isPending}>{generate.isPending ? 'Generating…' : 'Generate image'}</Button>
    </form>
    {generate.isError && <p role="alert">Image generation failed. Your description is preserved; try again when the service is available.</p>}
    {generate.data?.images.length === 0 && <p role="status">The provider returned no images. Try a different description.</p>}
    <div className="grid gap-6 md:grid-cols-2">{generate.data?.images.filter(image => /^https:\/\//i.test(image.url)).map((image, index) => <figure key={`${image.url}-${index}`}>
      <img src={image.url} alt={image.prompt} className="w-full rounded-lg" referrerPolicy="no-referrer" />
      <figcaption className="mt-2">{image.prompt} <a href={image.url} target="_blank" rel="noopener noreferrer" className="underline">Open image to save</a></figcaption>
    </figure>)}</div>
    <p className="text-sm">Results remain in this page session. Save images you want to keep before leaving; provider links may expire.</p>
  </section>;
}
