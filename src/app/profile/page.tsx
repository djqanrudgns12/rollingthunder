import { redirect } from 'next/navigation';
import { getProfileOverviewAction } from '@/presentation/actions/profileActions';
import ProfileCard from '@/components/profile/ProfileCard';

export const metadata = {
  title: 'Profile | Rolling Thunder',
  description: 'VVIP Membership Hub',
};

export default async function ProfilePage() {
  const profile = await getProfileOverviewAction();

  if (!profile) {
    redirect('/login');
  }

  return (
    <main>
      <ProfileCard profile={profile} />
    </main>
  );
}
