import dynamic from 'next/dynamic'

export type { MapMarker, MapProps } from '@/components/map'

const Map = dynamic(() => import('@/components/map'), { ssr: false })
export default Map
