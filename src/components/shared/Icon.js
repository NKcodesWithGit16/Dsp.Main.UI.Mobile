import { Ionicons } from '@expo/vector-icons';

export default function Icon({ name, size = 20, color, style }) {
  return <Ionicons name={name} size={size} color={color} style={style} />;
}
