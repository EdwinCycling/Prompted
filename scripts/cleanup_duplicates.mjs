import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)

async function run() {
  const { data: prompts, error: pErr } = await supabase
    .from('prompts')
    .select('id,image_url')
  if (pErr) throw pErr

  const { data: allImages, error: iErr } = await supabase
    .from('prompt_images')
    .select('id,prompt_id,path,image_url')
  if (iErr) throw iErr

  const imagesByPrompt = new Map()
  for (const img of allImages) {
    const arr = imagesByPrompt.get(img.prompt_id) || []
    arr.push(img)
    imagesByPrompt.set(img.prompt_id, arr)
  }

  let removedCount = 0
  for (const prompt of prompts) {
    const keepPath = (() => {
      const v = prompt.image_url || null
      if (!v) return null
      if (/^https?:\/\//.test(v)) {
        const m = v.match(/storage\/v1\/object\/public\/prompt-images\/(.+)$/)
        return m ? m[1] : null
      }
      return v
    })()
    const imgs = imagesByPrompt.get(prompt.id) || []
    if (!imgs.length) continue

    if (!keepPath) {
      const keep = imgs[0]
      await supabase.from('prompts').update({ image_url: keep.path }).eq('id', prompt.id)
      for (let i = 1; i < imgs.length; i++) {
        const img = imgs[i]
        await supabase.storage.from('prompt-images').remove([img.path])
        await supabase.from('prompt_images').delete().eq('id', img.id)
        removedCount++
      }
      continue
    }

    for (const img of imgs) {
      if (img.path !== keepPath) {
        await supabase.storage.from('prompt-images').remove([img.path])
        await supabase.from('prompt_images').delete().eq('id', img.id)
        removedCount++
      }
    }
  }

  console.log(`Removed ${removedCount} duplicate images`)
}

run().catch((e) => { console.error(e); process.exit(1) })
