import { Stack } from 'expo-router';
import RoleGate from '../../src/components/RoleGate';

export default function DriverLayout() {
  return (
    <RoleGate allow="driver">
      <Stack screenOptions={{ headerShown: false }} />
    </RoleGate>
  );
}
