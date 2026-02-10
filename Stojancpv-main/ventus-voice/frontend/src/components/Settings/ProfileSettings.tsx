import { useState } from 'react';
import { Save, Upload, User, Mail, Building } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';

interface ProfileData {
  fullName: string;
  email: string;
  role: string;
  company: string;
  bio: string;
  avatarUrl?: string;
}

export function ProfileSettings() {
  const [profile, setProfile] = useState<ProfileData>({
    fullName: 'John Doe',
    email: 'john.doe@example.com',
    role: 'Product Manager',
    company: 'Acme Inc.',
    bio: '',
    avatarUrl: undefined,
  });

  const [hasChanges, setHasChanges] = useState(false);

  const handleChange = (field: keyof ProfileData, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    // TODO: Implement save logic
    toast.success('Profile updated successfully');
    setHasChanges(false);
  };

  const handleAvatarUpload = () => {
    // TODO: Implement avatar upload
    toast.success('Avatar uploaded successfully');
    setHasChanges(true);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <Card className="bg-surface/70 backdrop-blur-xl border-border/50">
        <CardHeader>
          <CardTitle className="text-xl">Profile Picture</CardTitle>
          <CardDescription>
            Upload a photo to personalize your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={profile.avatarUrl} alt={profile.fullName} />
              <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                {getInitials(profile.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <Button onClick={handleAvatarUpload} variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                Upload Photo
              </Button>
              <p className="text-xs text-muted-foreground">
                JPG, PNG or GIF. Max size 2MB.
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
            Update your personal details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full-name">Full Name</Label>
              <Input
                id="full-name"
                value={profile.fullName}
                onChange={(e) => handleChange('fullName', e.target.value)}
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="bg-background/50"
                disabled
              />
              <p className="text-xs text-muted-foreground">
                Email changes require verification
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                value={profile.role}
                onChange={(e) => handleChange('role', e.target.value)}
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={profile.company}
                onChange={(e) => handleChange('company', e.target.value)}
                className="bg-background/50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={profile.bio}
              onChange={(e) => handleChange('bio', e.target.value)}
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
            setProfile({
              fullName: 'John Doe',
              email: 'john.doe@example.com',
              role: 'Product Manager',
              company: 'Acme Inc.',
              bio: '',
              avatarUrl: undefined,
            });
            setHasChanges(false);
            toast.info('Changes discarded');
          }}
          disabled={!hasChanges}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={!hasChanges}
          className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Save className="h-4 w-4" />
          Save Changes
        </Button>
      </div>
    </div>
  );
}
