import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AngularFirestore } from 'angularfire2/firestore';
import { DataService } from '../../core/data.service';
import { Observable } from 'rxjs/Observable';
import { map } from 'rxjs/operators';
import { EntryTableData, User } from '../../core/user.model';
import { MatTableDataSource, MatSort, MatPaginator } from '@angular/material';
import { Subscription, ISubscription } from 'rxjs/Subscription';
import { AngularFirestoreDocument } from 'angularfire2/firestore';
import { PapaParseService } from 'ngx-papaparse';
import * as moment from 'moment';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { SelectionModel } from '@angular/cdk/collections';
import * as firebase from 'firebase/app';
import * as _ from 'lodash';

declare var $: any;

const initialSelection = [];
const allowMultiSelect = true;

declare interface DataTable {
    headerRow: string[];
    footerRow: string[];
}

@Component({
    moduleId: module.id,
    selector: 'data-table-cmp',
    templateUrl: 'viewentries.component.html'
})

export class ViewentriesComponent implements OnInit, OnDestroy, AfterViewInit {
    // dataRows: Observable<EntryTableData[]>;
    displayedColumns = ['select', 'teamName', 'category', 'stage', 'status', 'scores', 'assignedTo'];
    dataSource = new MatTableDataSource<EntryTableData>();
    dataDetail: EntryTableData[];
    private entriesSubscription: Subscription;
    private judgesSubscription: Subscription;
    userSubscription: ISubscription;
    categories: string[] = ['pharmaceutical', 'medical', 'devices', 'hospital', 'services', 'digital', 'diagnostics'];
    stages: string[] = ['ideation', 'poc', 'revenues'];
    statuses: string[] = ['submitted', 'approved', 'rejected', 'scored'];
    judges: any[] = [];
    user: User;
    loading: boolean;

    @ViewChild(MatSort) sort: MatSort;
    @ViewChild(MatPaginator) paginator: MatPaginator;

    selectedCategory: string;
    selectedStage: string;
    selectedFilter: string;
    selectedStatus: string;
    minScore: number;
    selectedJudges: string[];

    // For Selection
    public selection = new SelectionModel<EntryTableData>(allowMultiSelect, initialSelection);

    constructor(
        private afs: AngularFirestore,
        private dataService: DataService,
        private papa: PapaParseService,
        private activatedRoute: ActivatedRoute,
        private router: Router,
        public authService: AuthService
    ) { }

    public dataTable: DataTable;

    ngOnInit() {

        this.judgesSubscription = this.dataService.usersChanged.subscribe((users: any[]) => {
            this.judgesSubscription.unsubscribe()
            this.judges = users;
        })

        this.dataService.getUsers(true);

        this.entriesSubscription = this.dataService.entriesChanged.subscribe((entries: EntryTableData[]) => {
            entries = _.compact(entries)

            entries.forEach((entry) => {
                this.dataService.getEmail(entry['userId']).then(data => {
                    if (data) {
                        entry['email'] = data['email']
                    }
                });
            });

            this.dataSource.data = entries;
        });

        this.activatedRoute.queryParams.subscribe(params => {
            this.selectedCategory = params['category']
            this.selectedStage = params['stage']
            this.selectedStatus = params['status']
            this.minScore = params['min'] || '0'
            this.userSubscription = this.authService.user$.subscribe(data => {
                this.user = data

                let role = this.user.roles.admin ? 'admin' : (this.user.roles.superjudge ? 'superjudge' : 'judge')
                let id = null;
                if(role === 'judge'){
                    id = this.user.uid
                }

                this.dataService.fetchEntries(
                    this.selectedCategory,
                    this.selectedStage,
                    this.selectedStatus,
                    role,
                    id
                );
            });
        }, error => {
            console.error(error)
        })

    }

    downloadSubmissionsCsv() {
        let csvData = this.papa.unparse(this.dataSource.data, { header: true })
        this.download(`Submissions - ${moment().format('MMM dd hhmmss')}`, csvData)
    }

    download(filename, text) {
        var element = document.createElement('a');
        element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(text));
        element.setAttribute('download', filename);

        element.style.display = 'none';
        document.body.appendChild(element);

        element.click();

        document.body.removeChild(element);
    }


    ngAfterViewInit() {
        this.dataSource.sort = this.sort;
        this.dataSource.paginator = this.paginator;
    }

    doFilter(filterValue?: string) {
        if (filterValue && filterValue.length >= 3) {
            this.dataSource.filter = filterValue.trim().toLowerCase();
        } else {
            this.dataSource.filter = null
        }
    }

    ngOnDestroy() {
        this.entriesSubscription.unsubscribe();
        this.dataSource.disconnect();
    }

    selectCategory(category) {
        this.router.navigate(['/a/entry/viewentries'], { queryParams: { category: category.value }, queryParamsHandling: 'merge' })
    }

    assignJudges() {
        this.loading = true
        if (this.selectedJudges && (this.selectedJudges.length === 2)) {
            this.selection.selected.forEach((submission, index) => {
                submission['loading'] = true
                let judgeEntries = _.map(this.selectedJudges, judge => {
                    return {
                        judgeUID: judge['uid'],
                        judgeName: judge['name']
                    }
                })

                let judges = _.fromPairs(_.zip(_.map(judgeEntries, 'judgeUID'), [true, true]))

                // Only allow changes to submissions if scoring is not initiated
                if (submission['status'] === 'approved' || submission['status'] === 'rejected') {
                    this.dataService.updateSubmission(submission.submissionId, {
                        judgeEntries: judgeEntries,
                        judges: judges
                    }).then(res => {
                        console.log(res)
                        submission['loading'] = false
                    }).catch(err => {
                        console.error(err);
                        submission['loading'] = true
                    })
                } else {
                    submission['loading'] = false
                    window.alert('Cannot change judges if idea is beyond approved stage')
                }

                if (this.selection.selected.length === (index + 1)) {
                    this.loading = false
                    window.alert(`${this.selection.selected.length} submissions have been assigned`)
                }
            })
        } else {
            window.alert('Please select 2 judges to assign these ideas to!')
        }
    }

    selectJudges(event) {
        this.selectedJudges = event.value
    }

    removeJudges(submission) {
        submission.loading = true
        this.dataService.updateSubmission(submission.submissionId, {
            judges: firebase.firestore.FieldValue.delete()
        }).then(r => {
            console.log(`${submission.submissionId} updated`)
            submission.loading = false;
        })

        // this.dataService.fetchEntries(this.selectedCategory, this.selectedStage, this.minScore.toString(), null, this.selectedStatus);
    }

    selectStage(stage) {
        this.router.navigate(['/a/entry/viewentries'], { queryParams: { stage: stage.value }, queryParamsHandling: 'merge' })
    }

    selectStatus(status) {
        if (status.value !== 'submitted') {
            this.router.navigate(['/a/entry/viewentries'], { queryParams: { status: status.value }, queryParamsHandling: 'merge' })
        } else {
            this.router.navigate(['/a/entry/viewentries'], { queryParams: { status: null }, queryParamsHandling: 'merge' })
        }
    }

    selectCipla(event) {
        if (event.checked) {
            this.doFilter('@cipla.com')
        } else {
            this.doFilter()
        }
    }

    reset() {
        this.selectedCategory = null
        this.selectedStage = null
        this.router.navigate(['/a/entry/viewentries'])
    }

    scrollTop() {
        $('.main-panel').scrollTop(0)
    }

    /** Whether the number of selected elements matches the total number of rows. */
    isAllSelected() {
        const numSelected = this.selection.selected.length;
        const numRows = this.dataSource.data.length;
        return numSelected == numRows;
    }

    /** Selects all rows if they are not all selected; otherwise clear selection. */
    masterToggle() {
        this.isAllSelected() ?
            this.selection.clear() :
            this.dataSource.data.forEach(row => this.selection.select(row));
    }

    getJudgeNames(judges:any) {
        let uids = _.keys(judges)
        let names = _.map(uids, uid => {
            let found = _.find(this.judges, {uid: uid})
            return found.name || 'No Name'
        })
        return names;
    }
}
