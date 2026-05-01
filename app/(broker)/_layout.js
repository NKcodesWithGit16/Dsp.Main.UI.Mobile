import { Stack } from 'expo-router';
import RoleGate from '../../src/components/RoleGate';

export default function BrokerLayout() {
  return (
    <RoleGate allow="broker">
      <Stack screenOptions={{ headerShown: false }} />
    </RoleGate>
  );
}
