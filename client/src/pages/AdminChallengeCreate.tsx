import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AdminLayout from '@/components/AdminLayout';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { adminApiRequest } from '@/lib/adminApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, ImagePlus } from 'lucide-react';

const createChallengeSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  category: z.string().min(1, "Category is required"),
  amount: z.string().refine((val) => parseFloat(val) > 0, "Amount must be positive"),
  endDate: z.string().optional(),
  isVisible: z.boolean().default(true),
  coverImage: z.instanceof(File).optional(),
});

type FormData = z.infer<typeof createChallengeSchema>;

const CATEGORIES = [
  { value: 'sports', label: '⚽ Sports' },
  { value: 'gaming', label: '🎮 Gaming' },
  { value: 'crypto', label: '💰 Crypto' },
  { value: 'trading', label: '📈 Trading' },
  { value: 'music', label: '🎵 Music' },
  { value: 'entertainment', label: '🎬 Entertainment' },
  { value: 'politics', label: '🏛️ Politics' },
];

export default function AdminChallengeCreate() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(createChallengeSchema),
    defaultValues: {
      title: '',
      description: '',
      category: 'politics',
      amount: '',
      endDate: '',
      isVisible: true,
    },
  });

  const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/gif', 'image/svg+xml', 'image/jpeg', 'image/png'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: 'Invalid format',
          description: 'Please use GIF, SVG, JPEG, or PNG format',
          variant: 'destructive',
        });
        return;
      }

      // Validate file size (max 2MB)
      const maxSize = 2 * 1024 * 1024; // 2MB
      if (file.size > maxSize) {
        toast({
          title: 'File too large',
          description: 'Image must be less than 2MB',
          variant: 'destructive',
        });
        return;
      }

      // For SVG and GIF, skip compression
      if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
        form.setValue('coverImage', file);
        const reader = new FileReader();
        reader.onloadend = () => {
          setCoverImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
        return;
      }

      // Compress JPEG and PNG
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Resize if larger than 1000x1000
        if (width > 1000 || height > 1000) {
          const ratio = Math.min(1000 / width, 1000 / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: file.lastModified,
                });
                form.setValue('coverImage', compressedFile);
                const reader = new FileReader();
                reader.onloadend = () => {
                  setCoverImagePreview(reader.result as string);
                };
                reader.readAsDataURL(blob);
              }
            },
            'image/jpeg',
            0.8
          );
        }
      };
      img.src = URL.createObjectURL(file);
    }
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', data.title);
      formData.append('description', data.description);
      formData.append('category', data.category);
      formData.append('amount', data.amount);
      formData.append('adminCreated', 'true');
      formData.append('status', 'open');
      formData.append('isVisible', String(data.isVisible));
      if (data.endDate) {
        formData.append('dueDate', new Date(data.endDate).toISOString());
      }
      if (data.coverImage) {
        formData.append('coverImage', data.coverImage);
      }

      const created = await adminApiRequest('/api/admin/challenges', {
        method: 'POST',
        body: formData,
      });
      toast({
        title: '✅ Challenge Created',
        description: `Challenge "${created.title}" (ID: ${created.id}) is now open for players`,
      });
      navigate('/admin/challenges');
    } catch (err: any) {
      toast({
        title: '❌ Creation Failed',
        description: err.message || 'Failed to create challenge',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">Create Challenge</h1>
          <p className="text-slate-400">Set up a new challenge for players to participate in</p>
        </div>

        <div className="grid gap-6">
          {/* Main Form */}
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Challenge Details</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Title & Category Row */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-300">Challenge Title *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Bitcoin Price Prediction - Dec 25"
                              {...field}
                              className="bg-slate-800 border-slate-700 text-white"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-300">Category *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-slate-800 border-slate-700">
                              {CATEGORIES.map((cat) => (
                                <SelectItem key={cat.value} value={cat.value}>
                                  {cat.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Description */}
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300">Description *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Explain the challenge, rules, and how to participate..."
                            rows={4}
                            {...field}
                            className="bg-slate-800 border-slate-700 text-white"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Cover Image Upload */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Cover Art/Icon (Optional)</label>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-center w-full">
                          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-700 rounded-lg cursor-pointer bg-slate-800 hover:bg-slate-700/50 transition-colors">
                              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <ImagePlus className="w-8 h-8 text-slate-400 mb-2" />
                                <p className="text-sm text-slate-400">Click to upload image</p>
                                <p className="text-xs text-slate-500">GIF, SVG, JPEG, PNG up to 2MB</p>
                              </div>
                              <input
                                type="file"
                                className="hidden"
                                accept=".gif,.svg,.jpg,.jpeg,.png,image/gif,image/svg+xml,image/jpeg,image/png"
                                onChange={handleCoverImageChange}
                              />
                            </label>
                          </div>
                      </div>
                      {coverImagePreview && (
                        <div className="flex items-center justify-center">
                          <img
                            src={coverImagePreview}
                            alt="Cover preview"
                            className="max-h-32 max-w-32 rounded-lg object-cover"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stake Amount */}
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300">Stake Amount (₦) *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="100"
                            min="100"
                            placeholder="1000"
                            {...field}
                            className="bg-slate-800 border-slate-700 text-white"
                          />
                        </FormControl>
                        <p className="text-xs text-slate-400 mt-2">
                          ℹ️ All players will join with this exact amount. Matching is automatic via first-come-first-served.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* End Date */}
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300">End Date (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="datetime-local"
                            {...field}
                            className="bg-slate-800 border-slate-700 text-white"
                          />
                        </FormControl>
                        <p className="text-xs text-slate-400 mt-2">
                          ℹ️ When the deadline passes, all remaining players are automatically refunded.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Visibility Toggle */}
                  <FormField
                    control={form.control}
                    name="isVisible"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between p-4 bg-slate-800 rounded-lg border border-slate-700">
                        <div>
                          <FormLabel className="text-slate-300 cursor-pointer">Visible to Players</FormLabel>
                          <p className="text-xs text-slate-400 mt-1">
                            Make this challenge visible in the public challenges list. You can hide it anytime.
                          </p>
                        </div>
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="w-5 h-5 rounded cursor-pointer"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4">
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        '✓ Create Challenge'
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate('/admin/challenges')}
                      className="border-slate-600 text-slate-300"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Info Cards */}
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-400" />
                  Pairing Engine
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-400">
                  Players join queues and are matched using FCFS with ±20% stake tolerance. Escrow locks automatically.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-green-400" />
                  Platform Fee
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-400">
                  5% fee deducted from total winnings. Example: ₦2000 pool → ₦1900 to winner, ₦100 to platform.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-purple-400" />
                  Admin Bonuses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-400">
                  After creation, activate bonuses for specific sides (YES/NO) to incentivize balanced participation.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
