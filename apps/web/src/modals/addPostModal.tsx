import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Image as ImageIcon, Play, RotateCcw, Send, Video as VideoIcon, X } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/lib/toast/toast-context';
import { useFanColors } from '@/theme/use-fan-colors';
import { createPost } from '@/lib/api/posts-create';

const IMAGE_MAX_MB=10, VIDEO_MAX_MB=50;
export default function AddPostModal({visible,onClose,onPostCreated}:{visible:boolean;onClose:()=>void;onPostCreated:()=>void}) {
 const colors=useFanColors(),toast=useToast(),{userId,username}=useAuth(),dialogRef=useRef<HTMLDivElement>(null),imageInput=useRef<HTMLInputElement>(null),videoInput=useRef<HTMLInputElement>(null);
 const [image,setImage]=useState<File|null>(null),[video,setVideo]=useState<File|null>(null),[caption,setCaption]=useState(''),[posting,setPosting]=useState(false);
 useEffect(()=>{if(!visible)return;setImage(null);setVideo(null);setCaption('');setPosting(false);},[visible]);
 useEffect(()=>{if(!visible)return;const previous=document.activeElement as HTMLElement|null;dialogRef.current?.querySelector<HTMLElement>('textarea')?.focus();const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();if(event.key!=='Tab'||!dialogRef.current)return;const items=Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled),textarea:not(:disabled),input:not(:disabled)'));if(!items.length)return;if(event.shiftKey&&document.activeElement===items[0]){event.preventDefault();items[items.length-1].focus();}else if(!event.shiftKey&&document.activeElement===items[items.length-1]){event.preventDefault();items[0].focus();}};document.addEventListener('keydown',onKey);return()=>{document.removeEventListener('keydown',onKey);previous?.focus();};},[visible,onClose]);
 const hasCaption=caption.trim().length>0,hasImage=image!==null,hasVideo=video!==null,hasMedia=hasImage||hasVideo,canPost=!posting&&(hasCaption||hasMedia);
 const imageUrl=image?URL.createObjectURL(image):null,videoUrl=video?URL.createObjectURL(video):null;
 useEffect(()=>()=>{if(imageUrl)URL.revokeObjectURL(imageUrl);if(videoUrl)URL.revokeObjectURL(videoUrl);},[imageUrl,videoUrl]);
 function acceptFile(file:File,kind:'image'|'video') {
  const max=kind==='image'?IMAGE_MAX_MB:VIDEO_MAX_MB;
  if(file.size/(1024*1024)>max){toast.showError(kind==='image'?`Image too large (max ${IMAGE_MAX_MB}MB)`:`Video too large (max ${VIDEO_MAX_MB}MB)`);return;}
  if(kind==='image'){setImage(file);setVideo(null);}else{setVideo(file);setImage(null);}
 }
 function pickImage(){imageInput.current?.click();}
 function pickVideo(){videoInput.current?.click();}
 function clearMedia(){setImage(null);setVideo(null);if(imageInput.current)imageInput.current.value='';if(videoInput.current)videoInput.current.value='';}
 function clearAll(){clearMedia();setCaption('');}
 async function handleSubmit(){
  if(!userId){toast.showError('Please login first');return;}
  if(!canPost){toast.showError('Please add a caption, image, or video');return;}
  setPosting(true);
  try{await createPost({userId,userName:username??'User',caption:caption.trim()||undefined,image:image??undefined,video:video??undefined});toast.showSuccess(hasVideo?'🎥 Post created':hasImage?'📷 Post created':'📝 Post created');onPostCreated();onClose();}
  catch(e:any){toast.showError(e?.message??'Failed to create post');}
  finally{setPosting(false);}
 }
 function postButtonLabel(){if(hasCaption&&hasVideo)return'Post Video';if(hasCaption&&hasImage)return'Post Image';if(hasVideo)return'Post Video';if(hasImage)return'Post Image';return'Post';}
 function postTypeLabel(){if(hasCaption&&hasVideo)return'📹 Video with caption';if(hasCaption&&hasImage)return'🖼️ Image with caption';if(hasVideo)return'🎬 Video post';if(hasImage)return'📸 Image post';if(hasCaption)return'📝 Text post';return'';}
 function fileSizeLabel(){if(video)return`${(video.size/(1024*1024)).toFixed(1)} MB`;if(image)return`${Math.round(image.size/1024)} KB`;return'';}
 if(!visible)return null;
 const PostIcon=hasVideo?VideoIcon:hasImage?ImageIcon:Send,headerIcon=hasVideo?VideoIcon:hasImage?ImageIcon:Camera;
 return createPortal(<div className="fixed inset-0 z-[970] flex items-end justify-center bg-black/55" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section ref={dialogRef} role="dialog" aria-modal="true" aria-label="Create Post" className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl" style={{background:colors.surface}}>
   <div className="flex justify-center pb-2 pt-3"><div className="h-1 w-8 rounded-full" style={{background:colors.border}}/></div>
   <header className="flex items-center gap-3 px-4 pb-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{background:colors.primaryDim,color:colors.primary}}><headerIcon size={20}/></div><div className="min-w-0 flex-1"><h2 className="text-sm font-bold text-white">{hasVideo?'Create Video Post':'Create Post'}</h2><p className="truncate text-[11px]" style={{color:colors.textSecondary}}>{username?`@${username}`:'Share your moment'}</p></div><button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2"><X size={18} color={colors.textPrimary}/></button></header>
   <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
    <div className="relative"><textarea value={caption} onChange={e=>setCaption(e.target.value)} placeholder="What's on your mind? (Optional)" maxLength={500} disabled={posting} rows={4} className="w-full resize-none rounded-xl border p-3 pb-7 text-sm text-white outline-none" style={{background:colors.bg,borderColor:hasCaption?colors.primary:colors.border}}/>{hasCaption&&<span className="absolute bottom-2 right-3 text-[10px] font-semibold" style={{color:colors.primary}}>{caption.length}/500</span>}</div>
    <div className="my-3 flex gap-2">
     <button type="button" onClick={pickImage} disabled={posting} className="flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-xs font-semibold" style={{background:hasImage?colors.primaryDim:colors.bg,borderColor:hasImage?colors.primary:colors.border,color:hasImage?colors.primary:colors.textSecondary}}><ImageIcon size={16}/>Photo</button>
     <button type="button" onClick={pickVideo} disabled={posting} className="flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-xs font-semibold" style={{background:hasVideo?colors.primaryDim:colors.bg,borderColor:hasVideo?colors.primary:colors.border,color:hasVideo?colors.primary:colors.textSecondary}}><VideoIcon size={16}/>Video</button>
     {hasMedia&&<button type="button" onClick={clearMedia} disabled={posting} className="flex items-center gap-1 rounded-xl border px-3 text-xs font-semibold" style={{borderColor:colors.border,color:colors.away}}><X size={15}/>Clear</button>}
     <input ref={imageInput} type="file" accept="image/*" className="hidden" onChange={e=>{const file=e.target.files?.[0];if(file)acceptFile(file,'image');e.currentTarget.value='';}}/>
     <input ref={videoInput} type="file" accept="video/*" className="hidden" onChange={e=>{const file=e.target.files?.[0];if(file)acceptFile(file,'video');e.currentTarget.value='';}}/>
    </div>
    {hasVideo&&video&&<div className="relative mb-3 overflow-hidden rounded-xl border" style={{borderColor:colors.border}}><div className="flex h-48 items-center justify-center bg-black"><Play size={48} color="#fff"/><div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-red-500 px-2 py-1 text-[9px] font-bold text-white"><VideoIcon size={12}/>VIDEO</div><span className="absolute bottom-3 left-3 rounded bg-black/60 px-2 py-1 text-[10px] text-white">{fileSizeLabel()}</span><button type="button" onClick={clearMedia} className="absolute right-3 top-3 rounded-full bg-black/60 p-1.5" aria-label="Remove video"><X size={16} color="#fff"/></button></div></div>}
    {hasImage&&image&&imageUrl&&<div className="relative mb-3 overflow-hidden rounded-xl border" style={{borderColor:colors.border}}><img src={imageUrl} alt={image.name} className="max-h-64 w-full object-cover"/><div className="absolute left-3 top-3 rounded-full bg-blue-500 px-2 py-1 text-[9px] font-bold text-white"><ImageIcon size={12} className="mr-1 inline"/>IMAGE</div><span className="absolute bottom-3 left-3 rounded bg-black/60 px-2 py-1 text-[10px] text-white">{fileSizeLabel()}</span><button type="button" onClick={clearMedia} className="absolute right-3 top-3 rounded-full bg-black/60 p-1.5" aria-label="Remove image"><X size={16} color="#fff"/></button></div>}
    {(hasCaption||hasMedia)&&<div className="mb-4 flex items-center gap-2 rounded-xl border p-3" style={{background:colors.bg,borderColor:colors.border}}><span style={{color:colors.primary}}>{hasVideo?<VideoIcon size={16}/>:hasImage?<ImageIcon size={16}/>:<Camera size={16}/>}</span><span className="text-xs font-semibold" style={{color:colors.textSecondary}}>{postTypeLabel()}</span></div>}
    <div className="flex gap-3"><button type="button" onClick={clearAll} disabled={posting||(!hasCaption&&!hasMedia)} className="flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold disabled:opacity-50" style={{borderColor:colors.border,color:colors.textSecondary}}><RotateCcw size={16}/>Clear</button><button type="button" onClick={()=>void handleSubmit()} disabled={!canPost} className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold disabled:opacity-60" style={{background:canPost?colors.primary:colors.bg,color:canPost?'#000':colors.textSecondary,border:canPost?'none':`1px solid ${colors.border}`}}>{posting?<span className="h-4 w-4 animate-spin rounded-full border-2 border-transparent border-t-current"/>:<PostIcon size={16}/ >}{postButtonLabel()}</button></div>
   </div>
  </section>
 </div>,document.body);
}
