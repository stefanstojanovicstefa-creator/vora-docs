import { useState, useEffect } from 'react';
import { Save, User, ExternalLink } from 'lucide-react';
import { useUser } from '@clerk/clerk-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';

interface ProfileMetadata {
  role?: string;
  company?: string;
  bio?: string;
}

export function ProfileSettings() {
  const { user, isLoaded } = useUser();

  const metadata = (user?.unsafeMetadata ?? {}) as ProfileMetadata;

  const [role, setRole] = useState(metadata.role ?? '');
  const [company, setCompany] = useState(metadata.company ?? '');
  const [bio, setBio] = useState(metadata.bio ?? '');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isLoaded && user) {
      const meta = (user.unsafeMetadata ?? {}) as ProfileMetadata;
      setRole(meta.role ?? '');
      setCompany(meta.company ?? '');
      setBio(meta.bio ?? '');
    }
  }, [isLoaded, user]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await user.update({
        unsafeMetadata: { role, company, bio },
      });
      toast.success('Profile updated successfully');
      setHasChanges(false);
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleManageAccount = () => {
    if (user) {
      // Opens Clerk's user profile management
      window.open('https://accounts.clerk.dev/user', '_blank');
    }
  };

  const fullName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ') || 'User'
    : 'Loading...';
  const email = user?.primaryEmailAddress?.emailAddress ?? 'Loading...';
  const avatarUrl = user?.imageUrl;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!isLoaded) {
    return (
      <div className="space-y-6 animate-pulse">
        <Card className="bg-surface/70 backdrop-blur-xl border-border/50 h-40" />
        <Card className="bg-surface/70 backdrop-blur-xl border-border/50 h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <Card className="bg-surface/70 backdrop-blur-xl border-border/50">
        <CardHeader>
          <CardTitle className="text-xl">Profile Picture</CardTitle>
          <CardDescription>
            Manage your profile picture through your Clerk account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={avatarUrl} alt={fullName} />
              <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                {getInitials(fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <Button onClick={handleManageAccount} variant="outline" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Manage Account
              </Button>
              <p className="text-xs text-muted-foreground">
                Change your avatar, name, and email through Clerk.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card className="bg-surface/70 backdrop-blur-xl border-border/50">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <User className="h-5 w-5" />
            Personal Information
          </CardTitle>
          <CardDescription>
            Your name and email are managed by Clerk. Role, company, and bio can be updated here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full-name">Full Name</Label>
              <Input
                id="full-name"
                value={fullName}
                className="bg-background/50"
                disabled
              />
              <p className="text-xs text-muted-foreground">
                Managed by Clerk
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                className="bg-background/50"
                disabled
              />
              <p className="text-xs text-muted-foreground">
                Managed by Clerk
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  setHasChanges(true);
                }}
                placeholder="e.g. Product Manager"
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => {
                  setCompany(e.target.value);
                  setHasChanges(true);
                }}
                placeholder="e.g. Acme Inc."
                className="bg-background/50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => {
                setBio(e.target.value);
                setHasChanges(true);
              }}
              placeholder="Tell us a bit about yourself..."
              rows={4}
              className="bg-background/50 resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Brief description for your profile. Maximum 250 characters.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 justify-end">
        <Button
          variant="outline"
          onClick={() => {
            const meta = (user?.unsafeMetadata ?? {}) as ProfileMetadata;
            setRole(meta.role ?? '');
            setCompany(meta.company ?? '');
            setBio(meta.bio ?? '');
            setHasChanges(false);
            toast.info('Changes discarded');
          }}
          disabled={!hasChanges}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
