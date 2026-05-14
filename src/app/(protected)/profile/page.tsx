'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  UserCircle,
  Mail,
  Shield,
  Calendar,
  Save,
  X,
  Lock,
  Eye,
  EyeOff,
  Camera,
  Loader2,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getServeFileUrl } from '@/lib/file-url';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { toTitleCase } from '@/lib/text-format';

interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  givenName: string | null;
  surname: string | null;
  middleName: string | null;
  extensionName: string | null;
  studentNumber: string | null;
  collegeInstitute: string | null;
  yearLevel: string | null;
  department: string | null;
  sex: string | null;
  role: string;
  status: string;
  profileImageUrl: string | null;
  createdAt: string;
}

const roleLabels: Record<string, string> = {
  superadmin: 'Super Admin',
  admin: 'Admin',
  staff: 'Staff',
  student_assistant: 'Student Assistant',
  makati_internship: 'Makati Internship Program',
};

const sexOptions = ['Male', 'Female', 'Prefer not to say'];
const yearLevelOptions = ['Grade 11', 'Grade 12', 'First Year Level', 'Second Year Level', 'Third Year Level', 'Fourth Year Level', 'Fifth Year Level'];

// Roles that are "staff-like" (non-student)
const STAFF_LIKE_ROLES = ['staff', 'admin', 'superadmin', 'student_assistant', 'makati_internship'];

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [givenName, setGivenName] = useState('');
  const [surname, setSurname] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [extensionName, setExtensionName] = useState('');
  const [sex, setSex] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [collegeInstitute, setCollegeInstitute] = useState('');
  const [yearLevel, setYearLevel] = useState('');
  const [department, setDepartment] = useState('');
  const [collegeOptions, setCollegeOptions] = useState<string[]>([]);
  const collegeInstituteOtherRef = useRef('');
  const [collegeOtherError, setCollegeOtherError] = useState('');

  // Derived: whether the current user is staff-like
  const isStaffLike = useMemo(
    () => !!profile && STAFF_LIKE_ROLES.includes(profile.role),
    [profile]
  );

  // Profile picture state
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Track original values for cancel
  const [originalValues, setOriginalValues] = useState({
    givenName: '',
    surname: '',
    middleName: '',
    extensionName: '',
    sex: '',
    studentNumber: '',
    collegeInstitute: '',
    yearLevel: '',
    department: '',
  });

  // Fetch college list
  useEffect(() => {
    async function fetchColleges() {
      try {
        const res = await fetch('/api/lists?type=college_institute');
        if (res.ok) {
          const data = await res.json();
          setCollegeOptions(data.map((c: { label: string }) => c.label));
        }
      } catch {}
    }
    fetchColleges();
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setGivenName(data.givenName || '');
        setSurname(data.surname || '');
        setMiddleName(data.middleName || '');
        setExtensionName(data.extensionName || '');
        setSex(data.sex || '');
        setStudentNumber(data.studentNumber || '');
        setCollegeInstitute(data.collegeInstitute || '');
        setYearLevel(data.yearLevel || '');
        setDepartment(data.department || '');
        setOriginalValues({
          givenName: data.givenName || '',
          surname: data.surname || '',
          middleName: data.middleName || '',
          extensionName: data.extensionName || '',
          sex: data.sex || '',
          studentNumber: data.studentNumber || '',
          collegeInstitute: data.collegeInstitute || '',
          yearLevel: data.yearLevel || '',
          department: data.department || '',
        });
      }
    } catch {
      // Profile fetch error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const effectiveCollegeInstitute = collegeInstitute === 'Other' && collegeInstituteOtherRef.current.trim() ? collegeInstituteOtherRef.current.trim() : collegeInstitute;
      if (!isStaffLike && collegeInstitute === 'Other' && !collegeInstituteOtherRef.current.trim()) {
        toast.error('Please specify your college/institute.');
        setCollegeOtherError('Please specify your college/institute');
        setSaving(false);
        return;
      }
      // Only send role-specific fields to avoid overwriting with empty strings
      const roleSpecificFields = isStaffLike
        ? { department }
        : { studentNumber, collegeInstitute: effectiveCollegeInstitute, yearLevel };

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          givenName: toTitleCase(givenName),
          surname: toTitleCase(surname),
          middleName: toTitleCase(middleName),
          extensionName: toTitleCase(extensionName),
          sex,
          ...roleSpecificFields,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setProfile(updated);
        setCollegeInstitute(effectiveCollegeInstitute);
        setOriginalValues({
          givenName,
          surname,
          middleName,
          extensionName,
          sex,
          studentNumber,
          collegeInstitute: effectiveCollegeInstitute,
          yearLevel,
          department,
        });
        toast.success('Profile updated successfully');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update profile');
      }
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  }, [givenName, surname, middleName, extensionName, sex, studentNumber, collegeInstitute, yearLevel, department, isStaffLike]);

  const handleCancel = useCallback(() => {
    setGivenName(originalValues.givenName);
    setSurname(originalValues.surname);
    setMiddleName(originalValues.middleName);
    setExtensionName(originalValues.extensionName);
    setSex(originalValues.sex);
    setStudentNumber(originalValues.studentNumber);
    setCollegeInstitute(originalValues.collegeInstitute);
    setYearLevel(originalValues.yearLevel);
    setDepartment(originalValues.department);
    collegeInstituteOtherRef.current = '';
    setCollegeOtherError('');
    toast.info('Changes discarded');
  }, [originalValues]);

  const handleChangePassword = useCallback(async () => {
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      if (res.ok) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        toast.success('Password updated successfully');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to change password');
      }
    } catch {
      toast.error('Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  }, [currentPassword, newPassword, confirmPassword]);

  const handleProfilePictureUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPG, PNG, and WebP images are allowed');
      e.target.value = '';
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5MB');
      e.target.value = '';
      return;
    }

    setUploadingPhoto(true);
    let uploadedUrl: string | null = null;
    try {
      // Step 1: Upload the file
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        toast.error(uploadData.error || 'Failed to upload image');
        return;
      }

      uploadedUrl = uploadData.url;

      // Step 2: Update profile with new image URL
      const profileRes = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileImageUrl: uploadedUrl }),
      });

      if (profileRes.ok) {
        const updated = await profileRes.json();
        setProfile(updated);
        toast.success('Profile picture updated');
        uploadedUrl = null; // Ownership transferred to profile — no cleanup needed
      } else {
        const profileData = await profileRes.json();
        // Step 2 failed: attempt to clean up the orphaned uploaded file
        try {
          await fetch('/api/upload', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: uploadedUrl }),
          });
          // Cleanup successful
        } catch {
          // Cleanup failed — best effort
        }
        toast.error(profileData.error || 'Failed to update profile picture. The uploaded file has been cleaned up.');
      }
    } catch (err) {
      // Profile picture upload error
      // If file was uploaded but we crashed before updating profile, try cleanup
      if (uploadedUrl) {
        try {
          await fetch('/api/upload', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: uploadedUrl }),
          });
          // Cleanup successful
        } catch {
          // Cleanup failed — best effort
        }
        toast.error('Failed to upload profile picture. The uploaded file has been cleaned up.');
      } else {
        toast.error('Failed to upload profile picture');
      }
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  }, []);

  const handleRemoveProfilePicture = useCallback(async () => {
    setUploadingPhoto(true);
    try {
      const oldUrl = profile?.profileImageUrl;
      const profileRes = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileImageUrl: '' }),
      });

      if (profileRes.ok) {
        const updated = await profileRes.json();
        setProfile(updated);
        // Attempt to delete the old file from disk (best-effort)
        if (oldUrl) {
          try {
            await fetch('/api/upload', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: oldUrl }),
            });
          } catch { /* best-effort */ }
        }
        toast.success('Profile picture removed');
      } else {
        const profileData = await profileRes.json();
        toast.error(profileData.error || 'Failed to remove profile picture');
      }
    } catch {
      toast.error('Failed to remove profile picture');
    } finally {
      setUploadingPhoto(false);
    }
  }, [profile?.profileImageUrl]);

  const initials = useMemo(
    () =>
      profile?.fullName
        ? profile.fullName
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
        : 'U',
    [profile?.fullName]
  );

  const memberSince = useMemo(
    () =>
      profile?.createdAt
        ? new Date(profile.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : '',
    [profile?.createdAt]
  );

  if (loading) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-lg bg-umak-gold/15 flex items-center justify-center">
          <UserCircle className="size-5 text-umak-gold" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-wider">PROFILE</h1>
          <p className="text-sm text-muted-foreground">Manage your account information</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="glass border-0 shadow-sm lg:col-span-1">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <div className="relative group">
                <Avatar className="size-20 border-2 border-umak-gold/30">
                  <AvatarImage src={getServeFileUrl(profile?.profileImageUrl) ?? undefined} alt={profile?.fullName || 'User'} />
                  <AvatarFallback className="bg-umak-blue text-white text-2xl font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {/* Hover overlay */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  aria-label="Change profile picture"
                >
                  {uploadingPhoto ? (
                    <Loader2 className="size-6 text-white animate-spin" />
                  ) : (
                    <Camera className="size-6 text-white" />
                  )}
                </button>
                {/* Camera button at bottom-right */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="absolute -bottom-1 -right-1 size-7 rounded-full bg-umak-gold hover:bg-umak-gold-hover text-umak-navy flex items-center justify-center shadow-md transition-colors cursor-pointer"
                  aria-label="Upload profile picture"
                >
                  {uploadingPhoto ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Camera className="size-3.5" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,image/webp"
                  onChange={handleProfilePictureUpload}
                  className="hidden"
                  aria-hidden="true"
                />
              </div>
              {profile?.profileImageUrl && (
                <button
                  type="button"
                  onClick={handleRemoveProfilePicture}
                  disabled={uploadingPhoto}
                  className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="size-3" />
                  Remove Photo
                </button>
              )}
              <h2 className="text-lg font-semibold mt-3">{profile?.fullName || 'User'}</h2>
              <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                <Mail className="size-3.5" />
                {profile?.email || ''}
              </div>
              <Badge
                className="mt-3 bg-umak-gold/15 text-umak-gold border-umak-gold/30 hover:bg-umak-gold/25"
              >
                <Shield className="size-3 mr-1" />
                {roleLabels[profile?.role || ''] || profile?.role || 'User'}
              </Badge>
              <Separator className="my-4" />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="size-3.5" />
                Member since {memberSince}
              </div>
              {profile?.status && (
                <Badge
                  variant="secondary"
                  className={`mt-3 text-xs ${
                    profile.status === 'active'
                      ? 'bg-status-approved/15 text-status-approved'
                      : 'bg-status-major/15 text-status-major'
                  }`}
                >
                  {profile.status === 'active' ? 'Active' : 'Deactivated'}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Edit Profile Form */}
        <Card className="glass border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold tracking-wider">EDIT PROFILE</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Given Name</Label>
                <Input
                  value={givenName}
                  onChange={(e) => setGivenName(e.target.value)}
                  className="h-9 text-sm"
                  placeholder="Enter given name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Surname</Label>
                <Input
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  className="h-9 text-sm"
                  placeholder="Enter surname"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Middle Name</Label>
                <Input
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  className="h-9 text-sm"
                  placeholder="Enter middle name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Extension Name</Label>
                <Input
                  value={extensionName}
                  onChange={(e) => setExtensionName(e.target.value)}
                  className="h-9 text-sm"
                  placeholder="e.g., Jr., Sr., III"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Email</Label>
                <Input
                  value={profile?.email || ''}
                  readOnly
                  className="h-9 text-sm bg-muted cursor-not-allowed"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Sex</Label>
                <Select value={sex} onValueChange={setSex}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select sex" />
                  </SelectTrigger>
                  <SelectContent>
                    {sexOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Role-based fields */}
              {isStaffLike ? (
                <>
                  {/* Staff/Admin/Superadmin/Faculty: Role (read-only) + Department (editable) */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Role</Label>
                    <Input
                      value={roleLabels[profile?.role || ''] || profile?.role || 'User'}
                      readOnly
                      className="h-9 text-sm bg-muted cursor-not-allowed"
                    />
                    <p className="text-[11px] text-muted-foreground">Your role is assigned by the administrator.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Department</Label>
                    <Input
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="h-9 text-sm"
                      placeholder="e.g., Discipline Coordinator, Formation Program Coordinator"
                    />
                    <p className="text-[11px] text-muted-foreground">Your department or role assignment within CSFD.</p>
                  </div>
                </>
              ) : (
                <>
                  {/* Student: Student Number, College/Institute, Year Level */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">UMak Student Number</Label>
                    <Input
                      value={studentNumber}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^[A-Za-z]\d*$/.test(val)) {
                          setStudentNumber(val);
                        }
                      }}
                      className="h-9 text-sm"
                      placeholder="Input your Student number"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">College / Institute</Label>
                    {collegeOptions.length > 0 ? (
                      <>
                        <Select
                          value={collegeInstitute}
                          onValueChange={(v) => {
                            setCollegeInstitute(v);
                            if (v !== 'Other') { collegeInstituteOtherRef.current = ''; }
                            setCollegeOtherError('');
                          }}
                        >
                          <SelectTrigger className="h-9 text-sm w-full">
                            <SelectValue placeholder="Select college/institute" />
                          </SelectTrigger>
                          <SelectContent>
                            {collegeOptions.map((college) => (
                              <SelectItem key={college} value={college}>{college}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {collegeInstitute === 'Other' && (
                          <div className="mt-1.5">
                            <Input
                              defaultValue={collegeInstituteOtherRef.current}
                              onChange={(e) => { collegeInstituteOtherRef.current = e.target.value; setCollegeOtherError(''); }}
                              className="h-9 text-sm"
                              placeholder="Please specify your college/institute"
                            />
                            {collegeOtherError && (
                              <p className="text-xs text-destructive mt-1">{collegeOtherError}</p>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <Input
                        value={collegeInstitute}
                        onChange={(e) => setCollegeInstitute(e.target.value)}
                        className="h-9 text-sm"
                        placeholder="Enter college or institute"
                      />
                    )}
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-medium">Year Level</Label>
                    <Select value={yearLevel} onValueChange={setYearLevel}>
                      <SelectTrigger className="h-9 text-sm w-full sm:w-1/2">
                        <SelectValue placeholder="Select year level" />
                      </SelectTrigger>
                      <SelectContent>
                        {yearLevelOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-3 mt-6">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-umak-gold hover:bg-umak-gold-hover text-umak-navy font-semibold gap-2"
              >
                {saving ? (
                  <>
                    <span className="size-4 border-2 border-umak-navy/30 border-t-umak-navy rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="size-4" />
                    SAVE CHANGES
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                className="gap-2"
              >
                <X className="size-4" />
                CANCEL
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Change Password Section */}
      <Card className="glass border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-umak-gold" />
            <CardTitle className="text-sm font-bold tracking-wider">CHANGE PASSWORD</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Current Password</Label>
              <div className="relative">
                <Input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="h-9 text-sm pr-9"
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">New Password</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-9 text-sm pr-9"
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Confirm New Password</Label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-9 text-sm pr-9"
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <Button
              onClick={handleChangePassword}
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="gap-2"
            >
              {changingPassword ? (
                <>
                  <span className="size-4 border-2 border-muted/30 border-t-muted rounded-full animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Lock className="size-4" />
                  UPDATE PASSWORD
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-lg" />
        <div>
          <Skeleton className="h-6 w-32 mb-1" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-72 rounded-xl" />
        <div className="lg:col-span-2">
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}
