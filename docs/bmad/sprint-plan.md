# Sprint Plan: Owebee

- **Sprint Number:** 2
- **Sprint Dates:** 2026-06-30 - 2026-07-13
- **Sprint Duration:** 2 weeks / 10 working days
- **Created:** 2026-06-30
- **Status:** Planned

## Sprint Overview

**Sprint Goal:** Дать Owebee первый рабочий продуктовый контур поездки: owner создает поездку с базовой валютой и invite link, гость присоединяется по ссылке, owner создает семейную группу, а валюта поездки валидируется через поддерживаемый каталог валют.

**Sprint Capacity:** 20 story points  
**Stories Planned:** 4 stories  
**Total Story Points:** 20 points

**Capacity Calculation:**
- **Baseline velocity:** 20 points по Sprint 1.
- **Team:** 1 full-stack developer.
- **Adjustment:** capacity оставлена на уровне 20 points, потому что Sprint 2 впервые затрагивает реальную доменную модель trips/members/currencies и access control.

## Velocity Metrics

**Historical Velocity:**
- Sprint 1: planned 20, completed 20, completion rate 100%.

**Recommended Capacity:** 20 points.

**Planning Note:** STORY-012 из PRD про автоматический курс валюты остается слишком широким для Sprint 2, пока нет расхода. Поэтому Sprint 2 добавляет foundation story STORY-023 для каталога валют и provider adapter contract; она блокирует будущую STORY-012.

## Sprint Backlog

### Epic 5: Валюты и курсы (5 points)

**Epic Goal:** Подготовить поддерживаемый валютный каталог, чтобы поездки и будущие расходы могли валидировать валюты одинаково на API и UI.

#### STORY-023: Currency catalog foundation and provider contract
- **Priority:** Must Have
- **Points:** 5
- **Status:** Not Started
- **Dependencies:** STORY-020, STORY-021
- **Brief:** Добавить каталог популярных валют Европы, СНГ, USD и EUR, API для списка валют и интерфейс adapter для будущего получения курсов.

---

### Epic 2: Поездки и управление жизненным циклом (5 points)

**Epic Goal:** Owner может создать поездку и получить ссылку приглашения.

#### STORY-004: Create trip and invite link
- **Priority:** Must Have
- **Points:** 5
- **Status:** Not Started
- **Dependencies:** STORY-001, STORY-021, STORY-023
- **Brief:** Реализовать `POST /api/v1/trips`, создание owner member и активного invite token без хранения raw token.

---

### Epic 1: Доступ, аккаунты и гостевые сессии (5 points)

**Epic Goal:** Приглашенный участник может войти в поездку без регистрации.

#### STORY-002: Guest join by invite link
- **Priority:** Must Have
- **Points:** 5
- **Status:** Not Started
- **Dependencies:** STORY-004
- **Brief:** Реализовать `POST /api/v1/invites/{inviteToken}/join`, создание guest member и долговечной guest session.

---

### Epic 3: Участники, семьи и доли (5 points)

**Epic Goal:** Owner может завести семью как агрегированного участника с несколькими персональными долями.

#### STORY-007: Create family with share count
- **Priority:** Must Have
- **Points:** 5
- **Status:** Not Started
- **Dependencies:** STORY-004
- **Brief:** Реализовать family aggregate в поездке, validate `shareCount > 0`, отображение семьи в участниках и основу для будущих расчетов.

## Story Prioritization

### Must Have

1. STORY-023 - Currency catalog foundation and provider contract (5 points)
2. STORY-004 - Create trip and invite link (5 points)
3. STORY-002 - Guest join by invite link (5 points)
4. STORY-007 - Create family with share count (5 points)

**Total Must Have:** 20 points

### Deferred From Candidate Backlog

- STORY-005 - Редактирование базовой валюты: deferred, потому что сначала нужен stable trip creation and currency catalog.
- STORY-012 - Автоматический курс валюты: deferred, потому что полный rate snapshot имеет смысл после expense creation foundation.
- STORY-016 - Offline expense creation: deferred до появления online expense model.

## Implementation Order

1. **Days 1-2:** STORY-023 - Currency catalog foundation and provider contract
   - Rationale: trip base currency needs server-side validation before trip creation becomes reliable.

2. **Days 3-5:** STORY-004 - Create trip and invite link
   - Rationale: guest join, family creation and expense work depend on a real trip.

3. **Days 6-7:** STORY-002 - Guest join by invite link
   - Rationale: validates public invite flow and guest session separation from invite token.

4. **Days 8-10:** STORY-007 - Create family with share count
   - Rationale: introduces the family/share-count model needed before split calculations.

## Story Dependencies

```text
STORY-020 Project scaffold
  └─> STORY-021 Core persistence
        ├─> STORY-023 Currency catalog
        │     └─> STORY-004 Create trip and invite link
        │           ├─> STORY-002 Guest join by invite link
        │           └─> STORY-007 Create family with share count
        └─> STORY-001 Registered owner account creation
              └─> STORY-004 Create trip and invite link
```

## Risks and Mitigation

### Risk 1: Currency provider scope expands into full expense conversion
- **Probability:** Medium
- **Impact:** Medium
- **Mitigation:** Keep STORY-023 limited to supported currency catalog, validation and provider adapter contract. No expense snapshots in Sprint 2.

### Risk 2: Invite flow mixes invite token and participant session token
- **Probability:** Medium
- **Impact:** High
- **Mitigation:** Store only token hashes and issue a separate guest session token after join.

### Risk 3: Family model becomes too detailed too early
- **Probability:** Medium
- **Impact:** Medium
- **Mitigation:** Sprint 2 supports aggregate family with `shareCount`; individual family members and balance breakdown remain later stories.

## Sprint Milestones

- **Day 2:** Currency catalog API and validation foundation complete.
- **Day 5:** Owner can create trip and receive invite link.
- **Day 7:** Guest can join trip by invite link and receives a durable session.
- **Day 10:** Owner can create family aggregate with share count.

## Definition of Done

A story is complete when:
- [ ] All acceptance criteria are met.
- [ ] Unit tests are written for new domain logic.
- [ ] Integration tests cover API/database flows.
- [ ] Access control is tested for owner-only and public endpoints.
- [ ] Lint/typecheck/test/build pass locally.
- [ ] Story file status can be moved to Completed.

## Burndown Tracking

| Date | Completed | Remaining | Ideal Remaining | Notes |
|------|-----------|-----------|-----------------|-------|
| 2026-06-30 | 0 | 20 | 20 | Sprint 2 planned |
| 2026-07-02 | To update | To update | 16 | Target: STORY-023 complete |
| 2026-07-06 | To update | To update | 10 | Target: STORY-004 complete |
| 2026-07-09 | To update | To update | 5 | Target: STORY-002 complete |
| 2026-07-13 | To update | To update | 0 | Target: STORY-007 complete |

## Next Sprint Candidate Backlog

1. STORY-005 - Редактирование базовой валюты.
2. STORY-006 - Архивирование и удаление поездки.
3. STORY-009 - Добавление расхода.
4. STORY-012 - Автоматический курс валюты and snapshot.
5. STORY-016 - Добавление расхода offline.

## Notes

- Sprint 2 intentionally starts with currency catalog foundation because trip creation requires base currency validation.
- Guest join is STORY-002 according to PRD. Previous backlog wording that mapped guest join to STORY-005 is corrected in sprint status.
- Full automatic rate conversion remains out of Sprint 2 scope.
