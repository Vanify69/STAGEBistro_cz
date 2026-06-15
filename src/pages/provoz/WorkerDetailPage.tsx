import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getApiBase } from '@/lib/api';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import type { Worker, WorkerStats, WagePayment } from '@/types/staff';
import { DpcLimitsBadge } from '@/components/staff/DpcLimitsBadge';
import { SignaturePad } from '@/components/staff/SignaturePad';
import { uploadContractScan, uploadSignaturePng } from '@/lib/staffUpload';
import { useProvozAuth } from '@/pages/provoz/useProvozAuth';

function kcToCents(v: string) {
  return Math.round(Number(String(v).replace(',', '.')) * 100) || 0;
}

export default function WorkerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { allowed } = useProvozAuth();
  const [payStep, setPayStep] = useState<'idle' | 'sign' | 'confirm'>('idle');
  const [recipientSig, setRecipientSig] = useState<string | null>(null);
  const [issuerSig, setIssuerSig] = useState<string | null>(null);
  const [selectedAtt, setSelectedAtt] = useState<string[]>([]);
  const [confirmOverLimit, setConfirmOverLimit] = useState(false);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [confirmTimes, setConfirmTimes] = useState<Record<string, { start: string; end: string }>>({});
  const [editAttTimes, setEditAttTimes] = useState<Record<string, { start: string; end: string }>>({});
  const [editingUnconfirmedId, setEditingUnconfirmedId] = useState<string | null>(null);
  const [editingUnpaidId, setEditingUnpaidId] = useState<string | null>(null);
  const [contractMsg, setContractMsg] = useState<string | null>(null);

  const workerQ = useQuery({
    queryKey: ['provoz', 'worker', id],
    queryFn: () => apiFetch<{ worker: Worker }>(`/api/provoz/workers/${id}`),
    enabled: allowed && Boolean(id),
  });

  const statsQ = useQuery({
    queryKey: ['provoz', 'worker', id, 'stats'],
    queryFn: () => apiFetch<{ stats: WorkerStats }>(`/api/provoz/workers/${id}/stats`),
    enabled: allowed && Boolean(id),
  });

  const unconfirmedQ = useQuery({
    queryKey: ['provoz', 'worker', id, 'unconfirmed'],
    queryFn: () =>
      apiFetch<{
        items: {
          shiftId: string;
          businessDate: string;
          plannedStart: string;
          plannedEnd: string;
        }[];
      }>(`/api/provoz/workers/${id}/unconfirmed`),
    enabled: allowed && Boolean(id),
  });

  const unpaidQ = useQuery({
    queryKey: ['provoz', 'worker', id, 'unpaid'],
    queryFn: () =>
      apiFetch<{
        items: {
          attendanceId: string;
          businessDate: string;
          workedMinutes: number | null;
          plannedStart: string;
          plannedEnd: string;
          actualStart: string | null;
          actualEnd: string | null;
        }[];
      }>(`/api/provoz/workers/${id}/unpaid`),
    enabled: allowed && Boolean(id),
  });

  const confirmAttendance = useMutation({
    mutationFn: (payload: { shiftId: string; actualStart: string; actualEnd: string }) =>
      apiFetch(`/api/provoz/workers/${id}/shifts/${payload.shiftId}/confirm-attendance`, {
        method: 'POST',
        body: JSON.stringify({
          actualStart: payload.actualStart,
          actualEnd: payload.actualEnd,
        }),
      }),
    onSuccess: () => {
      setEditingUnconfirmedId(null);
      qc.invalidateQueries({ queryKey: ['provoz', 'worker', id] });
      qc.invalidateQueries({ queryKey: ['provoz', 'worker', id, 'unconfirmed'] });
      qc.invalidateQueries({ queryKey: ['provoz', 'worker', id, 'unpaid'] });
      qc.invalidateQueries({ queryKey: ['provoz', 'worker', id, 'stats'] });
    },
  });

  const updateUnpaidTimes = useMutation({
    mutationFn: (payload: { attendanceId: string; actualStart: string; actualEnd: string }) =>
      apiFetch(`/api/provoz/attendance/${payload.attendanceId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          actualStart: payload.actualStart,
          actualEnd: payload.actualEnd,
        }),
      }),
    onSuccess: () => {
      setEditingUnpaidId(null);
      qc.invalidateQueries({ queryKey: ['provoz', 'worker', id, 'unpaid'] });
      qc.invalidateQueries({ queryKey: ['provoz', 'worker', id, 'stats'] });
      qc.invalidateQueries({ queryKey: ['provoz', 'payment-preview', id] });
    },
  });

  const getConfirmTimes = (item: { shiftId: string; plannedStart: string; plannedEnd: string }) =>
    confirmTimes[item.shiftId] ?? { start: item.plannedStart, end: item.plannedEnd };

  const getEditAttTimes = (item: {
    attendanceId: string;
    actualStart: string | null;
    actualEnd: string | null;
    plannedStart: string;
    plannedEnd: string;
  }) =>
    editAttTimes[item.attendanceId] ?? {
      start: item.actualStart ?? item.plannedStart,
      end: item.actualEnd ?? item.plannedEnd,
    };

  const paymentsQ = useQuery({
    queryKey: ['provoz', 'worker', id, 'payments'],
    queryFn: () => apiFetch<{ payments: WagePayment[] }>(`/api/provoz/workers/${id}/payments`),
    enabled: allowed && Boolean(id),
  });

  const w = workerQ.data?.worker;
  const [form, setForm] = useState<Partial<Worker>>({});

  const save = useMutation({
    mutationFn: () =>
      apiFetch(`/api/provoz/workers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          firstName: form.firstName ?? w?.firstName,
          lastName: form.lastName ?? w?.lastName,
          birthDate: form.birthDate ?? w?.birthDate,
          address: form.address ?? w?.address,
          phone: form.phone ?? w?.phone,
          bankAccountNumber: form.bankAccountNumber ?? w?.bankAccountNumber,
          maidenName: form.maidenName ?? w?.maidenName,
          healthInsurance: form.healthInsurance ?? w?.healthInsurance,
          position: form.position ?? w?.position,
          workPlace: form.workPlace ?? w?.workPlace,
          hourlyRateCents: form.hourlyRateCents ?? w?.hourlyRateCents,
          contractStart: form.contractStart ?? w?.contractStart,
          contractEnd: form.contractEnd ?? w?.contractEnd,
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['provoz', 'worker', id] }),
  });

  const genContract = useMutation({
    mutationFn: () => apiFetch(`/api/provoz/workers/${id}/contract/generate`, { method: 'POST', body: '{}' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['provoz', 'worker', id] }),
  });

  const uploadScan = useMutation({
    mutationFn: async () => {
      if (!id || !scanFile) throw new Error('Vyberte soubor se skenem smlouvy');
      await uploadContractScan(id, scanFile);
    },
    onSuccess: () => {
      setScanFile(null);
      qc.invalidateQueries({ queryKey: ['provoz', 'worker', id] });
    },
  });

  const signContract = useMutation({
    mutationFn: async () => {
      if (!recipientSig) throw new Error('Podpis zaměstnance je povinný');
      return apiFetch(`/api/provoz/workers/${id}/contract/sign-worker`, {
        method: 'POST',
        body: JSON.stringify({ signatureDataUrl: recipientSig }),
      });
    },
    onSuccess: () => {
      setRecipientSig(null);
      qc.invalidateQueries({ queryKey: ['provoz', 'worker', id] });
    },
  });

  const previewPay = useQuery({
    queryKey: ['provoz', 'payment-preview', id, selectedAtt],
    queryFn: () =>
      apiFetch<{ amountCents: number; limits: { monthWouldExceed: boolean; yearBlocked: boolean } }>(
        `/api/provoz/workers/${id}/payments/preview`,
        { method: 'POST', body: JSON.stringify({ attendanceRecordIds: selectedAtt }) }
      ),
    enabled: selectedAtt.length > 0 && payStep !== 'idle',
  });

  const submitPay = useMutation({
    mutationFn: async () => {
      if (!recipientSig || !issuerSig) throw new Error('Oba podpisy jsou povinné');
      const recKey = await uploadSignaturePng(
        `/api/provoz/workers/${id}/payments/presign-signature?role=recipient`,
        recipientSig
      );
      const issKey = await uploadSignaturePng(
        `/api/provoz/workers/${id}/payments/presign-signature?role=issuer`,
        issuerSig
      );
      return apiFetch(`/api/provoz/workers/${id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          attendanceRecordIds: selectedAtt,
          recipientSignatureKey: recKey,
          issuerSignatureKey: issKey,
          confirmOverLimit,
        }),
      });
    },
    onSuccess: () => {
      setPayStep('idle');
      setSelectedAtt([]);
      setRecipientSig(null);
      setIssuerSig(null);
      setConfirmOverLimit(false);
      qc.invalidateQueries({ queryKey: ['provoz', 'worker', id] });
    },
    onError: (err: Error & { requiresConfirm?: boolean }) => {
      if (String(err.message).includes('11 500')) setPayStep('confirm');
    },
  });

  const del = useMutation({
    mutationFn: () => apiFetch(`/api/provoz/workers/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['provoz', 'workers'] });
      window.location.href = '/provoz/zamestnanci';
    },
  });

  const openContractPdf = async () => {
    setContractMsg(null);
    const base = getApiBase();
    const useFileEndpoint =
      w?.contractSource === 'scan' ||
      w?.status === 'active' ||
      Boolean(w?.contractPdfKey);
    const path = useFileEndpoint
      ? `/api/provoz/workers/${id}/contract/file`
      : `/api/provoz/workers/${id}/contract/pdf`;
    try {
      const res = await fetch(`${base}${path}`, { credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((err as { error?: string }).error ?? 'PDF nelze otevřít');
      }
      if (res.headers.get('X-Contract-Regenerated') === '1') {
        setContractMsg('Smlouva v úložišti chyběla — byla znovu vygenerována z uloženého podpisu.');
        qc.invalidateQueries({ queryKey: ['provoz', 'worker', id] });
      }
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (e) {
      setContractMsg(e instanceof Error ? e.message : 'PDF nelze otevřít');
    }
  };

  if (workerQ.isLoading || !w) return <p className="text-sm text-black/60">Načítání…</p>;

  const f = { ...w, ...form };
  const canDownloadContract = Boolean(
    w.contractPdfKey || w.status === 'contract_pending' || (w.status === 'active' && w.contractSignedAt)
  );
  const needsWorkerSignature =
    w.status === 'active' && w.contractSource !== 'scan' && w.contractHasWorkerSignature === false;

  return (
    <div className="space-y-8 max-w-xl">
      <Link to="/provoz/zamestnanci" className="text-sm text-black/60 hover:text-black">
        ← Zaměstnanci
      </Link>
      <h2 className="text-xl font-medium">
        {w.firstName} {w.lastName}
      </h2>

      {statsQ.data?.stats && <DpcLimitsBadge stats={statsQ.data.stats} />}

      <section className="space-y-3 border border-black/10 p-4 rounded">
        <h3 className="font-medium">Údaje</h3>
        <div className="grid gap-2">
          <Label>Jméno</Label>
          <Input defaultValue={w.firstName} onChange={(e) => setForm((x) => ({ ...x, firstName: e.target.value }))} />
          <Label>Příjmení</Label>
          <Input defaultValue={w.lastName} onChange={(e) => setForm((x) => ({ ...x, lastName: e.target.value }))} />
          <Label>Narození</Label>
          <Input
            type="date"
            defaultValue={w.birthDate ?? ''}
            onChange={(e) => setForm((x) => ({ ...x, birthDate: e.target.value || null }))}
          />
          <Label>Adresa</Label>
          <Input defaultValue={w.address ?? ''} onChange={(e) => setForm((x) => ({ ...x, address: e.target.value }))} />
          <Label>Telefon</Label>
          <Input
            type="tel"
            defaultValue={w.phone ?? ''}
            placeholder="+420 …"
            onChange={(e) => setForm((x) => ({ ...x, phone: e.target.value || null }))}
          />
          <Label>Číslo účtu</Label>
          <Input
            defaultValue={w.bankAccountNumber ?? ''}
            placeholder="123456789/0100"
            onChange={(e) => setForm((x) => ({ ...x, bankAccountNumber: e.target.value || null }))}
          />
          <Label>Rodné příjmení</Label>
          <Input
            defaultValue={w.maidenName ?? ''}
            placeholder="volitelné"
            onChange={(e) => setForm((x) => ({ ...x, maidenName: e.target.value || null }))}
          />
          <Label>Zdravotní pojišťovna</Label>
          <Input
            defaultValue={w.healthInsurance ?? ''}
            placeholder="např. VZP"
            onChange={(e) => setForm((x) => ({ ...x, healthInsurance: e.target.value || null }))}
          />
          <Label>Pozice</Label>
          <Input defaultValue={w.position} onChange={(e) => setForm((x) => ({ ...x, position: e.target.value }))} />
          <Label>Mzda (Kč/h)</Label>
          <Input
            defaultValue={String(w.hourlyRateCents / 100)}
            onChange={(e) => setForm((x) => ({ ...x, hourlyRateCents: kcToCents(e.target.value) }))}
          />
          <Label>Smlouva od</Label>
          <Input
            type="date"
            defaultValue={w.contractStart ?? ''}
            onChange={(e) => setForm((x) => ({ ...x, contractStart: e.target.value || null }))}
          />
          <Label>Smlouva do</Label>
          <Input
            type="date"
            defaultValue={w.contractEnd ?? ''}
            onChange={(e) => setForm((x) => ({ ...x, contractEnd: e.target.value || null }))}
          />
        </div>
        <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
          Uložit
        </Button>
      </section>

      <section className="space-y-3 border border-black/10 p-4 rounded">
        <h3 className="font-medium">Smlouva DPC</h3>
        <p className="text-sm text-black/60">
          Stav: {w.status}
          {w.contractSource === 'scan' && ' · nahrán sken'}
          {w.contractSource === 'generated' && w.status === 'active' && ' · digitální podpis'}
        </p>
        {w.status === 'active' && !w.contractAccountingSeenAt && (
          <p className="text-sm text-amber-800">
            Čeká na zpracování účetním
            {w.contractAccountingEmailedAt
              ? ` · účetní informována e-mailem ${new Date(w.contractAccountingEmailedAt).toLocaleString('cs-CZ')}`
              : ' · e-mail účetní zatím neodeslán (zkontrolujte SMTP v API)'}
          </p>
        )}
        {canDownloadContract && (
          <Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={() => void openContractPdf()}>
            Stáhnout / zobrazit smlouvu PDF
          </Button>
        )}
        {contractMsg && (
          <p className={`text-sm ${contractMsg.includes('chyběla') ? 'text-amber-700' : 'text-red-600'}`}>
            {contractMsg}
          </p>
        )}
        {w.contractPdfUrl && (
          <a href={w.contractPdfUrl} target="_blank" rel="noreferrer" className="text-sm underline block">
            Veřejný odkaz (R2)
          </a>
        )}
        {genContract.isError && (
          <p className="text-sm text-red-600">{(genContract.error as Error).message}</p>
        )}
        {w.status !== 'active' && (
          <Button type="button" variant="outline" onClick={() => genContract.mutate()} disabled={genContract.isPending}>
            {genContract.isPending ? 'Generuji…' : 'Vygenerovat smlouvu PDF'}
          </Button>
        )}
        {(w.status === 'contract_pending' || w.status === 'draft') && (
          <>
            <div className="space-y-2 border-t border-black/10 pt-3">
              <Label>Podpis zaměstnance (digitálně)</Label>
              <SignaturePad onChange={setRecipientSig} />
              <Button type="button" onClick={() => signContract.mutate()} disabled={signContract.isPending}>
                Potvrdit podpis a aktivovat
              </Button>
            </div>
            <div className="space-y-2 border-t border-black/10 pt-3">
              <Label>Nebo nahrát sken podepsané smlouvy</Label>
              <p className="text-xs text-black/50">PDF nebo fotografie (JPEG/PNG). Po nahrání se zaměstnanec aktivuje a smlouva se odešle účetní.</p>
              <Input
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={(e) => setScanFile(e.target.files?.[0] ?? null)}
              />
              {uploadScan.isError && (
                <p className="text-sm text-red-600">{(uploadScan.error as Error).message}</p>
              )}
              <Button
                type="button"
                variant="secondary"
                onClick={() => uploadScan.mutate()}
                disabled={!scanFile || uploadScan.isPending}
              >
                {uploadScan.isPending ? 'Nahrávám…' : 'Nahrát sken a aktivovat'}
              </Button>
            </div>
          </>
        )}
        {needsWorkerSignature && (
          <div className="space-y-2 border-t border-amber-200 bg-amber-50/50 p-3 rounded">
            <p className="text-sm text-amber-900">
              Digitální podpis zaměstnance v systému chybí — doplňte ho pro kompletní smlouvu PDF.
            </p>
            <Label>Podpis zaměstnance (digitálně)</Label>
            <SignaturePad onChange={setRecipientSig} />
            {signContract.isError && (
              <p className="text-sm text-red-600">{(signContract.error as Error).message}</p>
            )}
            <Button type="button" onClick={() => signContract.mutate()} disabled={signContract.isPending}>
              {signContract.isPending ? 'Ukládám…' : 'Doplnit podpis a uložit do smlouvy'}
            </Button>
          </div>
        )}
      </section>

      {(unconfirmedQ.data?.items.length ?? 0) > 0 && (
        <section className="space-y-3 border border-amber-200 bg-amber-50/50 p-4 rounded">
          <h3 className="font-medium">Nepotvrzené směny</h3>
          <p className="text-xs text-black/60">
            Hodiny se započítají až po potvrzení docházky. Potvrďte směny dle plánu, pak je lze vyplatit.
          </p>
          <ul className="text-sm space-y-2">
            {unconfirmedQ.data!.items.map((item) => {
              const times = getConfirmTimes(item);
              const isEditing = editingUnconfirmedId === item.shiftId;
              return (
                <li key={item.shiftId} className="border border-black/10 rounded p-2 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {item.businessDate} · {item.plannedStart}–{item.plannedEnd}
                    </span>
                    {!isEditing ? (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingUnconfirmedId(item.shiftId)}
                        >
                          Upravit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            confirmAttendance.mutate({
                              shiftId: item.shiftId,
                              actualStart: item.plannedStart,
                              actualEnd: item.plannedEnd,
                            })
                          }
                          disabled={confirmAttendance.isPending}
                        >
                          Potvrdit
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingUnconfirmedId(null)}
                      >
                        Zrušit
                      </Button>
                    )}
                  </div>
                  {isEditing && (
                    <>
                      <div className="grid grid-cols-2 gap-2 max-w-xs">
                        <div>
                          <Label className="text-xs">Příchod</Label>
                          <Input
                            type="time"
                            value={times.start}
                            onChange={(e) =>
                              setConfirmTimes((prev) => ({
                                ...prev,
                                [item.shiftId]: { ...times, start: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Odchod</Label>
                          <Input
                            type="time"
                            value={times.end}
                            onChange={(e) =>
                              setConfirmTimes((prev) => ({
                                ...prev,
                                [item.shiftId]: { ...times, end: e.target.value },
                              }))
                            }
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          confirmAttendance.mutate({
                            shiftId: item.shiftId,
                            actualStart: times.start,
                            actualEnd: times.end,
                          })
                        }
                        disabled={confirmAttendance.isPending}
                      >
                        Potvrdit směnu
                      </Button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-3 border border-black/10 p-4 rounded">
        <h3 className="font-medium">Výplata (VPP)</h3>
        {(unpaidQ.data?.items ?? []).length === 0 && (
          <p className="text-sm text-black/50">
            Žádné potvrzené nevyplacené směny. Nejprve potvrďte docházku v sekci výše nebo na{' '}
            <Link to="/dochazka" className="underline">
              /dochazka
            </Link>
            .
          </p>
        )}
        <ul className="text-sm space-y-3">
          {(unpaidQ.data?.items ?? []).map((item) => {
            const times = getEditAttTimes(item);
            const isEditing = editingUnpaidId === item.attendanceId;
            const displayStart = item.actualStart ?? item.plannedStart;
            const displayEnd = item.actualEnd ?? item.plannedEnd;
            return (
              <li key={item.attendanceId} className="border border-black/10 rounded p-2 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedAtt.includes(item.attendanceId)}
                      onChange={(e) => {
                        setSelectedAtt((prev) =>
                          e.target.checked
                            ? [...prev, item.attendanceId]
                            : prev.filter((x) => x !== item.attendanceId)
                        );
                      }}
                    />
                    <span>
                      {item.businessDate} {displayStart}–{displayEnd} —{' '}
                      {((item.workedMinutes ?? 0) / 60).toFixed(2)} h
                    </span>
                  </div>
                  {!isEditing ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingUnpaidId(item.attendanceId)}
                    >
                      Upravit
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingUnpaidId(null)}
                    >
                      Zrušit
                    </Button>
                  )}
                </div>
                {isEditing && (
                  <>
                    <div className="grid grid-cols-2 gap-2 max-w-xs">
                      <div>
                        <Label className="text-xs">Příchod</Label>
                        <Input
                          type="time"
                          value={times.start}
                          onChange={(e) =>
                            setEditAttTimes((prev) => ({
                              ...prev,
                              [item.attendanceId]: { ...times, start: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Odchod</Label>
                        <Input
                          type="time"
                          value={times.end}
                          onChange={(e) =>
                            setEditAttTimes((prev) => ({
                              ...prev,
                              [item.attendanceId]: { ...times, end: e.target.value },
                            }))
                          }
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateUnpaidTimes.mutate({
                          attendanceId: item.attendanceId,
                          actualStart: times.start,
                          actualEnd: times.end,
                        })
                      }
                      disabled={updateUnpaidTimes.isPending}
                    >
                      Uložit časy
                    </Button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
        {payStep === 'idle' && (
          <>
            <Button
              type="button"
              disabled={!selectedAtt.length || w.status !== 'active'}
              onClick={() => setPayStep('sign')}
            >
              Vyplatit v hotovosti
            </Button>
            {(unpaidQ.data?.items.length ?? 0) > 0 && !selectedAtt.length && (
              <p className="text-xs text-black/50">Vyberte směny k výplatě zaškrtnutím výše.</p>
            )}
          </>
        )}
        {payStep === 'sign' && (
          <div className="space-y-4">
            {previewPay.data && (
              <p className="text-sm">
                Částka: {(previewPay.data.amountCents / 100).toFixed(2)} Kč
                {previewPay.data.limits.monthWouldExceed && (
                  <span className="text-amber-700 block">Pozor: překročení 11 500 Kč/měsíc</span>
                )}
              </p>
            )}
            <div>
              <Label>Podpis příjemce</Label>
              <SignaturePad onChange={setRecipientSig} />
            </div>
            <div>
              <Label>Podpis vydal (provozní)</Label>
              <SignaturePad onChange={setIssuerSig} />
            </div>
            <Button type="button" onClick={() => submitPay.mutate()} disabled={submitPay.isPending}>
              {submitPay.isPending ? 'Vystavuji…' : 'Vystavit VPP'}
            </Button>
            {submitPay.isError && (
              <p className="text-sm text-red-600">{(submitPay.error as Error).message}</p>
            )}
            <Button type="button" variant="outline" onClick={() => setPayStep('idle')}>
              Zrušit
            </Button>
          </div>
        )}
        {payStep === 'confirm' && (
          <div className="space-y-2 border border-amber-300 bg-amber-50 p-3 rounded">
            <p className="text-sm">Výplata překročí měsíční limit 11 500 Kč. Potvrdit?</p>
            <Button
              type="button"
              onClick={() => {
                setConfirmOverLimit(true);
                submitPay.mutate();
              }}
            >
              Ano, pokračovat
            </Button>
          </div>
        )}
        <ul className="text-xs text-black/60 pt-2 space-y-1">
          {(paymentsQ.data?.payments ?? []).map((p) => (
            <li key={p.id}>
              {p.vppNumber} — {(p.amountCents / 100).toFixed(2)} Kč
              {p.pdfUrl && (
                <>
                  {' '}
                  <a href={p.pdfUrl} target="_blank" rel="noreferrer" className="underline">
                    PDF
                  </a>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      <Button type="button" variant="outline" className="text-red-700" onClick={() => del.mutate()}>
        Přesunout do koše
      </Button>
    </div>
  );
}
