import { useEffect, useMemo, useState } from "react";
import { api, ApiError, openAuthorizedEventStream } from "./api";
import type {
  AnalysisInstruction,
  AnalysisResponse,
  AppPage,
  CallResponse,
  CallStatus,
  CompanyResponse,
  DepartmentMemberResponse,
  DepartmentResponse,
  Invitation,
  SessionState,
  Subscription,
  TranscriptionResponse,
  UserResponse,
  AdminCapabilitiesResponse
} from "./types";

import {
  companyIdFromPath,
  departmentIdFromPath,
  pageFromPath,
} from "./app/runtime";
import { callIdFromLocation, pageUrl } from "./app/location";
import { useTheme } from "./app/use-theme";
import { loadOrganizationContext, loadWorkspaceContext } from "./app/workspace-loader";
import { AnalysisPage } from "./features/analysis/AnalysisPage";
import { CallsPage } from "./features/calls/CallsPage";
import { CompaniesPage } from "./features/companies/CompaniesPage";
import { InstructionsPage } from "./features/instructions/InstructionsPage";
import { InvitationsPage } from "./features/invitations/InvitationsPage";
import { Landing } from "./features/landing/Landing";
import { AuthenticatedShell } from "./features/layout/AuthenticatedShell";
import { MonitoringPage } from "./features/monitoring/MonitoringPage";
import { OverviewPage } from "./features/overview/OverviewPage";
import { DevicesPage, ProfileEditPage, ProfilePage } from "./features/profile/ProfilePage";
import { AiReportsPage } from "./features/reports/AiReportsPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { TariffsPage } from "./features/tariffs/TariffsPage";
import { UploadPage } from "./features/upload/UploadPage";
import { AdminPage } from "./features/admin/AdminPage";
import {
  nextTimelineStatuses,
  parseCallStatusEvent,
  timelineFromStatus
} from "./shared/lib/call-status";
import { useAuth } from "./features/auth/AuthProvider";

const callsRefreshIntervalMs = 5_000;

function App() {
  const { session, ready: authReady, setAuthenticatedUser, clearSession } = useAuth();
  const [adminCapabilities, setAdminCapabilities] = useState<AdminCapabilitiesResponse | null>(null);
  const [showPublicLanding, setShowPublicLanding] = useState(true);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [page, setPage] = useState<AppPage>(() => pageFromPath(window.location.pathname));
  const [selectedCompanyId, setSelectedCompanyId] = useState(() => companyIdFromPath(window.location.pathname));
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(() => departmentIdFromPath(window.location.pathname));
  const [calls, setCalls] = useState<CallResponse[]>([]);
  const [companies, setCompanies] = useState<CompanyResponse[]>([]);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [departmentMembers, setDepartmentMembers] = useState<DepartmentMemberResponse[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [instructions, setInstructions] = useState<AnalysisInstruction[]>([]);
  const [personalSubscription, setPersonalSubscription] = useState<Subscription | null>(null);
  const [companySubscriptions, setCompanySubscriptions] = useState<Record<string, Subscription | null>>({});
  const [transcriptions, setTranscriptions] = useState<Record<string, TranscriptionResponse>>({});
  const [analyses, setAnalyses] = useState<Record<string, AnalysisResponse>>({});
  const [callTimelines, setCallTimelines] = useState<Record<string, CallStatus[]>>({});
  const [selectedCallId, setSelectedCallId] = useState<string>(() => callIdFromLocation());
  const [loadingWorkspace, setLoadingWorkspace] = useState(() => Boolean(session));
  const [loadingCallDetails, setLoadingCallDetails] = useState<Record<string, boolean>>({});
  const { theme: activeTheme, toggleTheme } = useTheme();

  useEffect(() => {
    let cancelled = false;
    if (!session) {
      setAdminCapabilities(null);
      return;
    }
    api.getAdminCapabilities()
      .then((value) => {
        if (!cancelled) setAdminCapabilities(value.permissions.includes("admin.panel.access") ? value : null);
      })
      .catch(() => {
        if (!cancelled) setAdminCapabilities(null);
      });
    return () => { cancelled = true; };
  }, [session]);

  useEffect(() => {
    if (!authReady) return;
    const requestedAppPage = window.location.pathname.startsWith("/app");
    setWorkspaceReady(true);
    if (session) {
      setShowPublicLanding(!requestedAppPage);
      setLoadingWorkspace(true);
      return;
    }
    setShowPublicLanding(true);
    if (requestedAppPage) {
      window.history.replaceState({}, "", "/");
      setPage(pageFromPath("/"));
      setSelectedCompanyId("");
      setSelectedDepartmentId("");
    }
  }, [authReady, session]);

  useEffect(() => {
    const onPopState = () => {
      setPage(pageFromPath(window.location.pathname));
      setSelectedCompanyId(companyIdFromPath(window.location.pathname));
      setSelectedDepartmentId(departmentIdFromPath(window.location.pathname));
      setSelectedCallId(callIdFromLocation());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      if (!authReady) return;

      if (!session) {
        clearWorkspaceState();
        setWorkspaceReady(true);
        setLoadingWorkspace(false);
        return;
      }

      setWorkspaceReady(true);
      setLoadingWorkspace(true);

      try {
        const loaded = await loadWorkspaceContext();

        if (cancelled) return;

        setCalls(loaded.calls);
        setCallTimelines(
          loaded.calls.reduce<Record<string, CallStatus[]>>((timelines, call) => {
            timelines[call.id] = timelineFromStatus(call.status);
            return timelines;
          }, {})
        );
        setCompanies(loaded.companies);
        setDepartments(loaded.departments);
        setDepartmentMembers(loaded.departmentMembers);
        setInvitations(loaded.invitations);
        setInstructions(loaded.instructions);
        setPersonalSubscription(loaded.personalSubscription);
        setCompanySubscriptions(loaded.companySubscriptions);
        setSelectedCallId((current) =>
          current && loaded.calls.some((call) => call.id === current)
            ? current
            : loaded.calls[0]?.id ?? ""
        );
        setWorkspaceReady(true);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          returnToLanding();
        } else {
          setWorkspaceReady(true);
        }
      } finally {
        if (!cancelled) setLoadingWorkspace(false);
      }
    }

    loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [authReady, session]);

  useEffect(() => {
    if (!session) return;

    let cancelled = false;
    let refreshing = false;

    async function refreshCalls() {
      if (refreshing) return;
      refreshing = true;

      try {
        const response = await api.listCalls();
        if (cancelled) return;

        const refreshedCalls = Array.isArray(response) ? response : response.items;
        setCalls(refreshedCalls);
        setCallTimelines((current) =>
          refreshedCalls.reduce<Record<string, CallStatus[]>>((timelines, call) => {
            timelines[call.id] = nextTimelineStatuses(
              current[call.id] ?? timelineFromStatus(call.status),
              call.status
            );
            return timelines;
          }, {})
        );
        setSelectedCallId((current) =>
          current && refreshedCalls.some((call) => call.id === current)
            ? current
            : refreshedCalls[0]?.id ?? ""
        );
      } catch {
        // Keep the last known list when a background refresh is temporarily unavailable.
      } finally {
        refreshing = false;
      }
    }

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") void refreshCalls();
    }

    void refreshCalls();
    const refreshTimer = window.setInterval(() => void refreshCalls(), callsRefreshIntervalMs);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);

    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, [session]);

  const selectedCall = useMemo(
    () => calls.find((call) => call.id === selectedCallId) ?? calls[0],
    [calls, selectedCallId]
  );
  const selectedCallDetailsLoading = selectedCall ? Boolean(loadingCallDetails[selectedCall.id]) : false;
  const selectedCallTimeline = selectedCall ? callTimelines[selectedCall.id] : undefined;

  useEffect(() => {
    if (!session || !selectedCall) return;

    let cancelled = false;
    const callId = selectedCall.id;

    setLoadingCallDetails((current) => ({
      ...current,
      [callId]: true
    }));

    Promise.allSettled([
      api.getTranscription(callId),
      api.getAnalysis(callId)
    ])
      .then(([transcriptionResult, analysisResult]) => {
        if (cancelled) return;

        if (transcriptionResult.status === "fulfilled") {
          setTranscriptions((current) => ({
            ...current,
            [callId]: transcriptionResult.value
          }));
        }

        if (analysisResult.status === "fulfilled") {
          setAnalyses((current) => ({
            ...current,
            [callId]: analysisResult.value
          }));
        }
      })
      .finally(() => {
        if (cancelled) return;

        setLoadingCallDetails((current) => ({
          ...current,
          [callId]: false
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCall?.id, selectedCall?.status, session]);

  useEffect(() => {
    if (!session || !selectedCall) return;

    const callId = selectedCall.id;
    const source = openAuthorizedEventStream(api.callEventsUrl(callId));
    let closed = false;

    function closeStream() {
      if (closed) return;
      closed = true;
      source.close();
    }

    source.addEventListener("status", (event) => {
      const statusEvent = parseCallStatusEvent(event);
      if (!statusEvent || statusEvent.call_id !== callId) return;

      setCalls((current) =>
        current.map((call) =>
          call.id === callId && call.status !== statusEvent.status
            ? { ...call, status: statusEvent.status }
            : call
        )
      );
      setCallTimelines((current) => ({
        ...current,
        [callId]: nextTimelineStatuses(
          current[callId] ?? timelineFromStatus(statusEvent.status),
          statusEvent.status
        )
      }));

      if (statusEvent.terminal) closeStream();
    });

    source.addEventListener("error", (event) => {
      if (event instanceof MessageEvent && typeof event.data === "string") {
        closeStream();
      }
    });

    return closeStream;
  }, [session, selectedCall?.id]);

  function navigate(nextPage: AppPage) {
    setShowPublicLanding(false);
    setPage(nextPage);
    setSelectedCompanyId("");
    setSelectedDepartmentId("");
    window.history.pushState({}, "", pageUrl(nextPage, selectedCallId));
  }

  function selectCall(callId: string) {
    setSelectedCallId(callId);
    if (page === "calls" || page === "analysis") {
      window.history.replaceState({}, "", pageUrl(page, callId));
    }
  }

  function openCallPage(callId: string, nextPage: AppPage = "calls") {
    setShowPublicLanding(false);
    setPage(nextPage);
    setSelectedCompanyId("");
    setSelectedDepartmentId("");
    setSelectedCallId(callId);
    window.history.pushState({}, "", pageUrl(nextPage, callId));
  }

  function openCompany(companyId: string) {
    setShowPublicLanding(false);
    setPage("settingsCompanies");
    setSelectedCompanyId(companyId);
    setSelectedDepartmentId("");
    window.history.pushState({}, "", `/app/settings/companies/${encodeURIComponent(companyId)}`);
  }

  function openDepartment(companyId: string, departmentId: string) {
    setShowPublicLanding(false);
    setPage("settingsCompanies");
    setSelectedCompanyId(companyId);
    setSelectedDepartmentId(departmentId);
    window.history.pushState(
      {},
      "",
      `/app/settings/companies/${encodeURIComponent(companyId)}/departments/${encodeURIComponent(departmentId)}`
    );
  }

  function applySession(nextSession: SessionState) {
    setAuthenticatedUser(nextSession.user);
    setWorkspaceReady(true);
    setLoadingWorkspace(true);
    navigate("overview");
  }

  function updateSessionUser(user: UserResponse) {
    setAuthenticatedUser(user);
  }

  async function logout() {
    if (session) {
      await api.logout().catch(() => undefined);
    }
    clearSession();
    clearWorkspaceState();
    setWorkspaceReady(true);
    setShowPublicLanding(true);
    window.history.pushState({}, "", "/");
    setPage("calls");
  }

  async function logoutAllSessions() {
    if (session) {
      await api.logoutAll().catch(() => undefined);
    }
    clearSession();
    clearWorkspaceState();
    setWorkspaceReady(true);
    setShowPublicLanding(true);
    window.history.pushState({}, "", "/");
    setPage("calls");
  }

  function openLanding() {
    setShowPublicLanding(true);
    window.history.pushState({}, "", "/");
  }

  function getStarted() {
    if (session) {
      navigate("overview");
      return;
    }

    setShowPublicLanding(true);
  }

  function clearWorkspaceState() {
    setCalls([]);
    setCompanies([]);
    setDepartments([]);
    setDepartmentMembers([]);
    setInvitations([]);
    setInstructions([]);
    setPersonalSubscription(null);
    setCompanySubscriptions({});
    setTranscriptions({});
    setAnalyses({});
    setCallTimelines({});
    setLoadingCallDetails({});
    setSelectedCallId("");
  }

  function returnToLanding() {
    clearSession();
    clearWorkspaceState();
    setWorkspaceReady(true);
    setShowPublicLanding(true);
    window.history.replaceState({}, "", "/");
    setPage("calls");
  }

  async function refreshOrganizationContext() {
    const loaded = await loadOrganizationContext();
    setCompanies(loaded.companies);
    setDepartments(loaded.departments);
    setDepartmentMembers(loaded.departmentMembers);
    setInstructions(loaded.instructions);
    setCompanySubscriptions(loaded.companySubscriptions);
  }

  async function deleteCall(callId: string) {
    await api.deleteCall(callId);

    setCalls((current) => {
      const nextCalls = current.filter((call) => call.id !== callId);
      setSelectedCallId((selectedId) => {
        if (selectedId !== callId) return selectedId;
        const nextCallId = nextCalls[0]?.id ?? "";
        if (page === "calls" || page === "analysis") {
          window.history.replaceState({}, "", pageUrl(page, nextCallId));
        }
        return nextCallId;
      });
      return nextCalls;
    });
    setTranscriptions((current) => {
      const { [callId]: _removed, ...rest } = current;
      return rest;
    });
    setAnalyses((current) => {
      const { [callId]: _removed, ...rest } = current;
      return rest;
    });
    setCallTimelines((current) => {
      const { [callId]: _removed, ...rest } = current;
      return rest;
    });
    setLoadingCallDetails((current) => {
      const { [callId]: _removed, ...rest } = current;
      return rest;
    });
  }

  async function updateCallTitle(callId: string, title: string) {
    const updatedCall = await api.updateCallTitle(callId, title);
    setCalls((current) => current.map((call) => (call.id === callId ? updatedCall : call)));
    return updatedCall;
  }

  if (!authReady) {
    return (
      <main className="landing preflight-screen" aria-label="Проверка сессии">
        <div className="landing-bg" />
      </main>
    );
  }

  if (!session || showPublicLanding) {
    return (
      <Landing
        session={session}
        theme={activeTheme}
        onAuth={applySession}
        onGetStarted={getStarted}
        onToggleTheme={toggleTheme}
      />
    );
  }

  if (!workspaceReady) {
    return (
      <main className="landing preflight-screen" aria-label="Проверка сессии">
        <div className="landing-bg" />
      </main>
    );
  }

  return (
    <AuthenticatedShell
      activePage={page}
      session={session}
      theme={activeTheme}
      calls={calls}
      companies={companies}
      personalSubscription={personalSubscription}
      companySubscriptions={companySubscriptions}
      invitationCount={invitations.filter((invitation) => invitation.status === "pending").length}
      adminCapabilities={adminCapabilities}
      onNavigate={navigate}
      onOpenCall={(callId) => {
        openCallPage(callId);
      }}
      onOpenCompany={openCompany}
      onOpenLanding={openLanding}
      onToggleTheme={toggleTheme}
      onLogout={logout}
    >
      {page === "overview" && (
          <OverviewPage
            calls={calls}
            callsVersion={calls.map((call) => `${call.id}:${call.status}:${call.created_at}`).join("|")}
          />
      )}

      {page === "calls" && (
        <CallsPage
          calls={calls}
          companies={companies}
          departments={departments}
          selectedCall={selectedCall}
          selectedCallId={selectedCallId}
          selectedCallTimeline={selectedCallTimeline}
          transcription={selectedCall ? transcriptions[selectedCall.id] : undefined}
          analysis={selectedCall ? analyses[selectedCall.id] : undefined}
          analyses={analyses}
          session={session}
          onSelectCall={selectCall}
          onNavigate={navigate}
          onUpdateCallTitle={updateCallTitle}
          onDeleteCall={deleteCall}
          loading={loadingWorkspace}
          loadingDetails={selectedCallDetailsLoading}
        />
      )}

      {page === "upload" && (
        <UploadPage
          session={session}
          companies={companies}
          departments={departments}
          departmentMembers={departmentMembers}
          instructions={instructions}
          loading={loadingWorkspace}
          onNavigate={navigate}
          onUploaded={(call) => {
            setCalls((current) => [call, ...current]);
            setCallTimelines((current) => ({
              ...current,
              [call.id]: timelineFromStatus(call.status)
            }));
            openCallPage(call.id);
          }}
        />
      )}

      {page === "analysis" && (
        <AnalysisPage
          session={session}
          calls={calls}
          selectedCall={selectedCall}
          selectedCallId={selectedCallId}
          selectedCallTimeline={selectedCallTimeline}
          analyses={analyses}
          instructions={instructions}
          companies={companies}
          departments={departments}
          loading={loadingWorkspace}
          loadingDetails={selectedCallDetailsLoading}
          onSelectCall={selectCall}
          onAnalysisReady={(callId, analysis) =>
            setAnalyses((current) => ({
              ...current,
              [callId]: analysis
            }))
          }
          onDeleteCall={deleteCall}
          onNavigate={navigate}
        />
      )}

      {page === "reports" && (
        <AiReportsPage
          calls={calls}
          analyses={analyses}
          companies={companies}
          departments={departments}
        />
      )}

      {page === "monitoring" && <MonitoringPage calls={calls} />}

      {page === "admin" && adminCapabilities && <AdminPage capabilities={adminCapabilities} />}

      {page === "settings" && <SettingsPage onNavigate={navigate} />}

      {page === "settingsInstructions" && (
        <InstructionsPage
          session={session}
          instructions={instructions}
          companies={companies}
          departments={departments}
          departmentMembers={departmentMembers}
          loading={loadingWorkspace}
          onBackToSettings={() => navigate("settings")}
          onInstructionCreated={(instruction) =>
            setInstructions((current) => [instruction, ...current])
          }
        />
      )}

      {page === "settingsInvitations" && (
        <InvitationsPage
          invitations={invitations}
          companies={companies}
          departments={departments}
          session={session}
          loading={loadingWorkspace}
          onBackToSettings={() => navigate("settings")}
          onInvitationCreated={(invitation) =>
            setInvitations((current) =>
              invitation.invited_user_uuid === session.user.id ? [invitation, ...current] : current
            )
          }
          onInvitationAccepted={async (invitation) => {
            setInvitations((current) => current.filter((item) => item.id !== invitation.id));
            await refreshOrganizationContext().catch(() => undefined);
          }}
          onInvitationDeclined={(invitation) =>
            setInvitations((current) => current.filter((item) => item.id !== invitation.id))
          }
        />
      )}

      {page === "settingsCompanies" && (
        <CompaniesPage
          session={session}
          companies={companies}
          departments={departments}
          calls={calls}
          companySubscriptions={companySubscriptions}
          loading={loadingWorkspace}
          onBackToSettings={() => navigate("settings")}
          selectedCompanyId={selectedCompanyId}
          selectedDepartmentId={selectedDepartmentId}
          onCompanyCreated={async (company) => {
            setCompanies((current) => [company, ...current]);
            await refreshOrganizationContext().catch(() => undefined);
          }}
          onDepartmentCreated={(department) => setDepartments((current) => [department, ...current])}
          onCompanyLeft={(companyId) => {
            setCompanies((current) => current.filter((company) => company.id !== companyId));
            setDepartments((current) => current.filter((department) => department.company_uuid !== companyId));
            setSelectedCompanyId("");
            setSelectedDepartmentId("");
          }}
          onNavigate={navigate}
          onOpenCompany={openCompany}
          onOpenDepartment={openDepartment}
          onInvitationCreated={(invitation) =>
            setInvitations((current) =>
              invitation.invited_user_uuid === session.user.id ? [invitation, ...current] : current
            )
          }
        />
      )}

      {page === "settingsProfile" && (
        <ProfilePage
          session={session}
          companies={companies}
          onBackToSettings={() => navigate("settings")}
          onUserUpdated={updateSessionUser}
          onCompanyCreated={async (company) => {
            setCompanies((current) => [company, ...current]);
            await refreshOrganizationContext().catch(() => undefined);
          }}
          onNavigate={navigate}
        />
      )}

      {page === "settingsProfileEdit" && (
        <ProfileEditPage
          session={session}
          onUserUpdated={updateSessionUser}
          onNavigate={navigate}
        />
      )}

      {page === "settingsDevices" && (
        <DevicesPage
          onBackToSettings={() => navigate("settings")}
          onLogoutAll={logoutAllSessions}
        />
      )}

      {page === "settingsTariffs" && (
        <TariffsPage
          session={session}
          companies={companies}
          personalSubscription={personalSubscription}
          companySubscriptions={companySubscriptions}
          onPersonalSubscriptionChanged={setPersonalSubscription}
          onCompanySubscriptionChanged={(subscription) => {
            if (!subscription.company_uuid) return;
            setCompanySubscriptions((current) => ({
              ...current,
              [subscription.company_uuid as string]: subscription
            }));
          }}
          onBackToSettings={() => navigate("settings")}
        />
      )}
    </AuthenticatedShell>
  );
}

export default App;
