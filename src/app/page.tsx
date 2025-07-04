import dynamic from 'next/dynamic'
 
const ImageCollageApp = dynamic(() => import('../components/ImageCollageApp'), { ssr: false })
 
export default function Home() {
  return <ImageCollageApp />
}
