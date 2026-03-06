import { View, Text } from 'react-native'

export default function MapView({ children, style }: any) {
  return (
    <View style={[{ backgroundColor: '#e8f0e8', alignItems: 'center', 
      justifyContent: 'center' }, style]}>
      <Text style={{ color: '#666', fontSize: 13 }}>🗺️ Map preview available on mobile only</Text>
      {children}
    </View>
  )
}

export const Marker = () => null
export const Polyline = () => null
export const Circle = () => null
export const Callout = () => null
export const PROVIDER_DEFAULT = null
