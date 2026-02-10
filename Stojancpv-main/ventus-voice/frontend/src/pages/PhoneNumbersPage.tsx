/**
 * PhoneNumbersPage
 * Phone number and SIP trunk management dashboard
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  Phone,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Settings,
  AlertCircle,
  Loader2,
  Server,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { sipService } from '../services/sip.service';
import { getErrorMessage } from '../lib/error-message';
import type {
  SIPTrunk,
  SIPProvider,
  SIPTrunkType,
  CreateSIPTrunkRequest,
} from '../types/sip.types';

// Provider options (uppercase to match backend schema)
const PROVIDERS: { value: SIPProvider; labelKey: string }[] = [
  { value: 'TELNYX', labelKey: 'common:pages.phoneNumbers.providers.telnyx' },
  { value: 'TWILIO', labelKey: 'common:pages.phoneNumbers.providers.twilio' },
  { value: 'VONAGE', labelKey: 'common:pages.phoneNumbers.providers.vonage' },
  { value: 'BANDWIDTH', labelKey: 'common:pages.phoneNumbers.providers.bandwidth' },
  { value: 'CUSTOM', labelKey: 'common:pages.phoneNumbers.providers.custom' },
];

// Trunk type options
const TRUNK_TYPES: { value: SIPTrunkType; labelKey: string }[] = [
  { value: 'INBOUND', labelKey: 'common:pages.phoneNumbers.trunkTypes.inbound' },
  { value: 'OUTBOUND', labelKey: 'common:pages.phoneNumbers.trunkTypes.outbound' },
  { value: 'BIDIRECTIONAL', labelKey: 'common:pages.phoneNumbers.trunkTypes.bidirectional' },
];

// Format phone number for display
function formatPhoneNumber(number: string): string {
  const cleaned = number.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return number;
}

// Format date for display
function formatDate(dateString: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString));
}

export default function PhoneNumbersPage() {
  const { t, i18n } = useTranslation(['common']);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTrunk, setSelectedTrunk] = useState<SIPTrunk | null>(null);
  const [activeTab, setActiveTab] = useState('trunks');

  // Form state
  const [formData, setFormData] = useState<CreateSIPTrunkRequest>({
    name: '',
    provider: 'TELNYX',
    trunkType: 'BIDIRECTIONAL',
    sipUri: '',
    username: '',
    password: '',
    providerConfig: {},
    phoneNumbers: [],
    inboundEnabled: true,
    outboundEnabled: true,
  });
  const [phoneNumberInput, setPhoneNumberInput] = useState('');

  const queryClient = useQueryClient();

  // Queries
  const {
    data: trunksData,
    isLoading: trunksLoading,
    refetch: refetchTrunks,
  } = useQuery({
    queryKey: ['sip-trunks'],
    queryFn: () => sipService.listTrunks({ limit: 100 }),
  });

  const { data: liveKitTrunks, isLoading: liveKitLoading } = useQuery({
    queryKey: ['livekit-trunks'],
    queryFn: () => sipService.listLiveKitTrunks(),
  });

  const { data: dispatchRules } = useQuery({
    queryKey: ['dispatch-rules'],
    queryFn: () => sipService.listDispatchRules(),
  });

  const { data: recentCalls } = useQuery({
    queryKey: ['recent-calls'],
    queryFn: () => sipService.listCalls({ limit: 10 }),
  });

  // Mutations
  const createTrunkMutation = useMutation({
    mutationFn: (request: CreateSIPTrunkRequest) => sipService.createTrunk(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sip-trunks'] });
      toast.success(t('common:pages.phoneNumbers.toasts.trunkCreated'));
      window.dispatchEvent(new CustomEvent('tutorial:validation', { detail: { key: 'phone_connected' } }));
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, t('common:pages.phoneNumbers.toasts.trunkCreateFailed')));
    },
  });

  const deleteTrunkMutation = useMutation({
    mutationFn: (trunkId: string) => sipService.deleteTrunk(trunkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sip-trunks'] });
      toast.success(t('common:pages.phoneNumbers.toasts.trunkDeleted'));
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, t('common:pages.phoneNumbers.toasts.trunkDeleteFailed')));
    },
  });

  const verifyTrunkMutation = useMutation({
    mutationFn: (trunkId: string) => sipService.verifyTrunk(trunkId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['sip-trunks'] });
      if (result.success) {
        toast.success(t('common:pages.phoneNumbers.toasts.trunkVerified'));
      } else {
        toast.error(t('common:pages.phoneNumbers.toasts.trunkVerifyFailed', { message: result.message }));
      }
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, t('common:pages.phoneNumbers.toasts.trunkVerifyFailedGeneric')));
    },
  });

  const updateTrunkMutation = useMutation({
    mutationFn: ({ trunkId, data }: { trunkId: string; data: any }) =>
      sipService.updateTrunk(trunkId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sip-trunks'] });
      toast.success(t('common:pages.phoneNumbers.toasts.trunkUpdated'));
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, t('common:pages.phoneNumbers.toasts.trunkUpdateFailed')));
    },
  });

  // Form handlers
  const resetForm = () => {
    setFormData({
      name: '',
      provider: 'TELNYX',
      trunkType: 'BIDIRECTIONAL',
      sipUri: '',
      username: '',
      password: '',
      providerConfig: {},
      phoneNumbers: [],
      inboundEnabled: true,
      outboundEnabled: true,
    });
    setPhoneNumberInput('');
  };

  const handleAddPhoneNumber = () => {
    if (phoneNumberInput.trim()) {
      setFormData((prev) => ({
        ...prev,
        phoneNumbers: [...(prev.phoneNumbers || []), phoneNumberInput.trim()],
      }));
      setPhoneNumberInput('');
    }
  };

  const handleRemovePhoneNumber = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      phoneNumbers: prev.phoneNumbers?.filter((_, i) => i !== index) || [],
    }));
  };

  const handleCreateTrunk = () => {
    if (!formData.name) {
      toast.error(t('common:pages.phoneNumbers.validation.trunkNameRequired'));
      return;
    }
    if (!formData.sipUri) {
      toast.error(t('common:pages.phoneNumbers.validation.sipUriRequired'));
      return;
    }
    // Validate SIP URI format (must be URL or start with sip:)
    const isValidSipUri = formData.sipUri.startsWith('sip:') ||
      /^https?:\/\//.test(formData.sipUri);
    if (!isValidSipUri) {
      toast.error(t('common:pages.phoneNumbers.validation.sipUriInvalid'));
      return;
    }
    createTrunkMutation.mutate(formData);
  };

  const handleDeleteTrunk = (trunkId: string) => {
    if (window.confirm(t('common:pages.phoneNumbers.confirm.deleteTrunk'))) {
      deleteTrunkMutation.mutate(trunkId);
    }
  };

  const handleToggleActive = (trunk: SIPTrunk) => {
    updateTrunkMutation.mutate({
      trunkId: trunk.id,
      data: { isActive: !trunk.isActive },
    });
  };

  // Calculate stats
  const totalNumbers = trunksData?.data.reduce(
    (acc, trunk) => acc + (trunk.phoneNumbers?.length || 0),
    0
  ) || 0;
  const activeTrunks = trunksData?.data.filter((t) => t.isActive).length || 0;
  const totalCalls = recentCalls?.pagination.total || 0;

  if (trunksLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Phone className="h-8 w-8" />
            {t('common:pages.phoneNumbers.title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('common:pages.phoneNumbers.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetchTrunks()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('common:actions.refresh')}
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('common:pages.phoneNumbers.actions.addTrunk')}
          </Button>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
            <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t('common:pages.phoneNumbers.cards.totalNumbers')}</CardDescription>
              <CardTitle className="text-3xl">{totalNumbers}</CardTitle>
            </CardHeader>
          </Card>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t('common:pages.phoneNumbers.cards.activeTrunks')}</CardDescription>
              <CardTitle className="text-3xl text-green-500">{activeTrunks}</CardTitle>
            </CardHeader>
          </Card>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t('common:pages.phoneNumbers.cards.totalCalls')}</CardDescription>
              <CardTitle className="text-3xl">{totalCalls.toLocaleString(i18n.language)}</CardTitle>
            </CardHeader>
          </Card>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t('common:pages.phoneNumbers.cards.dispatchRules')}</CardDescription>
              <CardTitle className="text-3xl">{dispatchRules?.length || 0}</CardTitle>
            </CardHeader>
          </Card>
        </motion.div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="trunks" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            {t('common:pages.phoneNumbers.tabs.trunks')}
          </TabsTrigger>
          <TabsTrigger value="numbers" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            {t('common:pages.phoneNumbers.tabs.numbers')}
          </TabsTrigger>
          <TabsTrigger value="calls" className="flex items-center gap-2">
            <PhoneCall className="h-4 w-4" />
            {t('common:pages.phoneNumbers.tabs.calls')}
          </TabsTrigger>
        </TabsList>

        {/* SIP Trunks Tab */}
        <TabsContent value="trunks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('common:pages.phoneNumbers.trunks.title')}</CardTitle>
              <CardDescription>
                {t('common:pages.phoneNumbers.trunks.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {trunksData?.data.length === 0 ? (
                <div className="text-center py-12">
                  <Server className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t('common:pages.phoneNumbers.trunks.emptyTitle')}</h3>
                  <p className="text-muted-foreground mb-4">
                    {t('common:pages.phoneNumbers.trunks.emptyDescription')}
                  </p>
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('common:pages.phoneNumbers.actions.addTrunk')}
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('common:terms.name')}</TableHead>
                      <TableHead>{t('common:pages.phoneNumbers.trunks.table.provider')}</TableHead>
                      <TableHead>{t('common:pages.phoneNumbers.trunks.table.phoneNumbers')}</TableHead>
                      <TableHead>{t('common:terms.status')}</TableHead>
                      <TableHead>{t('common:pages.phoneNumbers.trunks.table.inbound')}</TableHead>
                      <TableHead>{t('common:pages.phoneNumbers.trunks.table.outbound')}</TableHead>
                      <TableHead>{t('common:pages.phoneNumbers.trunks.table.lastUsed')}</TableHead>
                      <TableHead className="text-right">{t('common:terms.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trunksData?.data.map((trunk) => (
                      <TableRow key={trunk.id}>
                        <TableCell className="font-medium">{trunk.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {trunk.provider}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {t('common:pages.phoneNumbers.trunks.table.numbersCount', { count: trunk.phoneNumbers?.length || 0 })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={trunk.isActive}
                              onCheckedChange={() => handleToggleActive(trunk)}
                            />
                            {trunk.isActive ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {trunk.inboundEnabled ? (
                            <PhoneIncoming className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell>
                          {trunk.outboundEnabled ? (
                            <PhoneOutgoing className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {trunk.lastUsedAt
                            ? formatDate(trunk.lastUsedAt, i18n.language)
                            : t('common:pages.phoneNumbers.trunks.table.never')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => verifyTrunkMutation.mutate(trunk.id)}
                              disabled={verifyTrunkMutation.isPending}
                            >
                              {verifyTrunkMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedTrunk(trunk)}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteTrunk(trunk.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Phone Numbers Tab */}
        <TabsContent value="numbers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('common:pages.phoneNumbers.numbers.title')}</CardTitle>
              <CardDescription>
                {t('common:pages.phoneNumbers.numbers.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {totalNumbers === 0 ? (
                <div className="text-center py-12">
                  <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t('common:pages.phoneNumbers.numbers.emptyTitle')}</h3>
                  <p className="text-muted-foreground mb-4">
                    {t('common:pages.phoneNumbers.numbers.emptyDescription')}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('common:pages.phoneNumbers.numbers.table.phoneNumber')}</TableHead>
                      <TableHead>{t('common:pages.phoneNumbers.numbers.table.trunk')}</TableHead>
                      <TableHead>{t('common:pages.phoneNumbers.trunks.table.provider')}</TableHead>
                      <TableHead>{t('common:terms.status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trunksData?.data.flatMap((trunk) =>
                      (trunk.phoneNumbers || []).map((number, index) => (
                        <TableRow key={`${trunk.id}-${index}`}>
                          <TableCell className="font-mono">
                            {formatPhoneNumber(number)}
                          </TableCell>
                          <TableCell>{trunk.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {trunk.provider}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {trunk.isActive ? (
                              <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                                {t('common:status.active')}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">{t('common:status.inactive')}</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Calls Tab */}
        <TabsContent value="calls" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('common:pages.phoneNumbers.calls.title')}</CardTitle>
              <CardDescription>
                {t('common:pages.phoneNumbers.calls.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentCalls?.data.length === 0 ? (
                <div className="text-center py-12">
                  <PhoneCall className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t('common:pages.phoneNumbers.calls.emptyTitle')}</h3>
                  <p className="text-muted-foreground">
                    {t('common:pages.phoneNumbers.calls.emptyDescription')}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('common:pages.phoneNumbers.calls.table.direction')}</TableHead>
                      <TableHead>{t('common:pages.phoneNumbers.calls.table.from')}</TableHead>
                      <TableHead>{t('common:pages.phoneNumbers.calls.table.to')}</TableHead>
                      <TableHead>{t('common:terms.status')}</TableHead>
                      <TableHead>{t('common:pages.phoneNumbers.calls.table.duration')}</TableHead>
                      <TableHead>{t('common:pages.phoneNumbers.calls.table.started')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentCalls?.data.map((call) => (
                      <TableRow key={call.id}>
                        <TableCell>
                          {call.direction === 'INBOUND' ? (
                            <div className="flex items-center gap-2">
                              <PhoneIncoming className="h-4 w-4 text-blue-500" />
                              <span>{t('common:pages.phoneNumbers.calls.directions.inbound')}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <PhoneOutgoing className="h-4 w-4 text-green-500" />
                              <span>{t('common:pages.phoneNumbers.calls.directions.outbound')}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono">
                          {formatPhoneNumber(call.fromNumber)}
                        </TableCell>
                        <TableCell className="font-mono">
                          {formatPhoneNumber(call.toNumber)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              call.status === 'COMPLETED'
                                ? 'default'
                                : call.status === 'FAILED'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {call.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {call.durationSeconds
                            ? `${Math.floor(call.durationSeconds / 60)}:${String(
                                call.durationSeconds % 60
                              ).padStart(2, '0')}`
                            : '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(call.startedAt, i18n.language)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Trunk Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('common:pages.phoneNumbers.createDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('common:pages.phoneNumbers.createDialog.description')}
            </DialogDescription>
          </DialogHeader>

            <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('common:pages.phoneNumbers.createDialog.fields.trunkName')}</Label>
              <Input
                id="name"
                placeholder={t('common:pages.phoneNumbers.createDialog.fields.trunkNamePlaceholder')}
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider">{t('common:pages.phoneNumbers.createDialog.fields.provider')}</Label>
              <Select
                value={formData.provider}
                onValueChange={(value: SIPProvider) =>
                  setFormData((prev) => ({ ...prev, provider: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('common:pages.phoneNumbers.createDialog.fields.providerPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {t(p.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="trunkType">{t('common:pages.phoneNumbers.createDialog.fields.trunkType')}</Label>
              <Select
                value={formData.trunkType}
                onValueChange={(value: SIPTrunkType) =>
                  setFormData((prev) => ({ ...prev, trunkType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('common:pages.phoneNumbers.createDialog.fields.trunkTypePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {TRUNK_TYPES.map((tt) => (
                    <SelectItem key={tt.value} value={tt.value}>
                      {t(tt.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sipUri">{t('common:pages.phoneNumbers.createDialog.fields.sipUri')}</Label>
              <Input
                id="sipUri"
                placeholder={t('common:pages.phoneNumbers.createDialog.fields.sipUriPlaceholder')}
                value={formData.sipUri}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, sipUri: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                {t('common:pages.phoneNumbers.createDialog.fields.sipUriHelp')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">{t('common:pages.phoneNumbers.createDialog.fields.username')}</Label>
                <Input
                  id="username"
                  placeholder={t('common:pages.phoneNumbers.createDialog.fields.usernamePlaceholder')}
                  value={formData.username || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, username: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t('common:pages.phoneNumbers.createDialog.fields.password')}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={t('common:pages.phoneNumbers.createDialog.fields.passwordPlaceholder')}
                  value={formData.password || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, password: e.target.value }))
                  }
                />
              </div>
            </div>

            {formData.provider === 'TELNYX' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="connectionId">{t('common:pages.phoneNumbers.createDialog.fields.telnyxConnectionId')}</Label>
                  <Input
                    id="connectionId"
                    placeholder={t('common:pages.phoneNumbers.createDialog.fields.telnyxConnectionIdPlaceholder')}
                    value={(formData.providerConfig as any)?.connectionId || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        providerConfig: {
                          ...prev.providerConfig,
                          connectionId: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apiKey">{t('common:pages.phoneNumbers.createDialog.fields.telnyxApiKey')}</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder={t('common:pages.phoneNumbers.createDialog.fields.telnyxApiKeyPlaceholder')}
                    value={(formData.providerConfig as any)?.apiKey || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        providerConfig: {
                          ...prev.providerConfig,
                          apiKey: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>{t('common:pages.phoneNumbers.createDialog.fields.phoneNumbers')}</Label>
              <div className="flex gap-2">
                <Input
                  placeholder={t('common:pages.phoneNumbers.createDialog.fields.phoneNumberPlaceholder')}
                  value={phoneNumberInput}
                  onChange={(e) => setPhoneNumberInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddPhoneNumber();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={handleAddPhoneNumber}>
                  {t('common:actions.add')}
                </Button>
              </div>
              {formData.phoneNumbers && formData.phoneNumbers.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.phoneNumbers.map((number, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      {formatPhoneNumber(number)}
                      <button
                        type="button"
                        onClick={() => handleRemovePhoneNumber(index)}
                        className="ml-1 hover:text-red-500"
                      >
                        <XCircle className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="inboundEnabled"
                  checked={formData.inboundEnabled}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, inboundEnabled: checked }))
                  }
                />
                <Label htmlFor="inboundEnabled">{t('common:pages.phoneNumbers.createDialog.fields.enableInbound')}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="outboundEnabled"
                  checked={formData.outboundEnabled}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, outboundEnabled: checked }))
                  }
                />
                <Label htmlFor="outboundEnabled">{t('common:pages.phoneNumbers.createDialog.fields.enableOutbound')}</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              {t('common:actions.cancel')}
            </Button>
            <Button
              onClick={handleCreateTrunk}
              disabled={createTrunkMutation.isPending}
            >
              {createTrunkMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {t('common:pages.phoneNumbers.createDialog.actions.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
