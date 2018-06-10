import { Component, OnDestroy, OnInit } from '@angular/core';
import { AngularFirestore } from 'angularfire2/firestore';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/mergeMap';
import { ActivatedRoute } from '@angular/router';
import printJS from 'print-js';
import {FormControl, FormGroup, Validators} from '@angular/forms';
import {Criteria, JudgeEntry} from '../../core/user.model';
import {AuthService} from '../../core/auth.service';

@Component({
  selector: 'app-detail',
  templateUrl: './detail.component.html',
  styleUrls: ['./detail.component.css']
})
export class DetailComponent implements OnInit, OnDestroy {
    userSubmission: Observable<{}>;
    submissionId: string;
    judgeEntryForm: FormGroup;
    showForm: boolean = false;
    judgeEntry: JudgeEntry;
    judgeId: string;

    revenuePotentialConst: Criteria[] = [
        {criteriaName: 'Less than 1M$', criteriaScore: 1},
        {criteriaName: '1-5M$', criteriaScore: 2},
        {criteriaName: '5-10M$', criteriaScore: 3},
        {criteriaName: 'More than 10M$', criteriaScore: 4}
    ];

    ciplaSynergyConst: Criteria[] = [
        {criteriaName: 'Yes', criteriaScore: 3},
        {criteriaName: 'Maybe', criteriaScore: 2},
        {criteriaName: 'No', criteriaScore: 1},
    ];

    implementabilityConst: Criteria[] = [
        {criteriaName: 'Idea is realistic', criteriaScore: 3},
        {criteriaName: 'Idea seems less likely', criteriaScore: 2},
        {criteriaName: 'Challenging to execute', criteriaScore: 1},
    ];

    uniquenessConst: Criteria[] = [
        {criteriaName: 'Idea is unique (nowhere implemented in the world)', criteriaScore: 3},
        {criteriaName: 'Idea is unique for India (implemented in developed markets)', criteriaScore: 3},
        {criteriaName: 'Idea is not unique however business model is streamlined and scalable', criteriaScore: 2},
        {criteriaName: 'Idea is not unique (many similar ideas exist in the market)', criteriaScore: 1},
    ];

    constructor(private afs: AngularFirestore, private route: ActivatedRoute, private authService: AuthService) { }

    ngOnInit() {
        this.submissionId = this.route.snapshot.params['id'];
        this.userSubmission = this.afs.collection('submissions')
          .doc(this.submissionId)
          .valueChanges();

        this.judgeEntryForm = new FormGroup({
            revenuePotential: new FormControl('', { validators: [Validators.required]}),
            ciplaSynergy: new FormControl('', { validators: [Validators.required] }),
            implementability: new FormControl('', { validators: [Validators.required] }),
            uniqueness: new FormControl('', { validators: [Validators.required] }),
            judgeComments: new FormControl('', { validators: [Validators.required] }),
            radioHealth: new FormControl('', { validators: [Validators.required] }),
            radioRev: new FormControl('', { validators: [Validators.required] }),
        });

        this.authService.user$.subscribe(data => {
            this.judgeId = data.uid;
        });
    }

    ngOnDestroy() {
    };

    saveJudgeEntry() {
        this.judgeEntry = {
            revPotential: this.judgeEntryForm.value.radioRev,
            healthcare: this.judgeEntryForm.value.radioHealth,
            revenuePotential3rd: {
                criteriaName: this.judgeEntryForm.value.revenuePotential,
                criteriaScore: this.revenuePotentialConst
                    .find(x => x.criteriaName === this.judgeEntryForm.value.revenuePotential).criteriaScore
            },
            implementability: {
                criteriaName: this.judgeEntryForm.value.implementability,
                criteriaScore: this.implementabilityConst
                    .find(x => x.criteriaName === this.judgeEntryForm.value.implementability).criteriaScore
            },
            synergy: {
                criteriaName: this.judgeEntryForm.value.ciplaSynergy,
                criteriaScore: this.ciplaSynergyConst
                    .find(x => x.criteriaName === this.judgeEntryForm.value.ciplaSynergy).criteriaScore
            },
            uniqueness: {
                criteriaName: this.judgeEntryForm.value.uniqueness,
                criteriaScore: this.uniquenessConst
                    .find(x => x.criteriaName === this.judgeEntryForm.value.uniqueness).criteriaScore
            },
            judgeUID: this.judgeId,
            comments: this.judgeEntryForm.value.judgeComments,
        };
        console.log(this.judgeEntry);
        this.afs.collection('submissions')
            .doc(this.submissionId).update({judgeEntry: this.judgeEntry})
            .then(function () {
                console.log("Transaction successfully committed!");
            })
            .catch(function (error) {console.log("Transaction failed: ", error);});
    };

    editJudgeEntry() {
        this.showForm = true;
    };

    cancelJudgeEntry() {
        this.showForm = false;
    };

    downloadPDF() {
    // $('#submission').focus()
    // window.print()
    printJS({
      printable: 'submission',
      type: 'html',
      css:'/assets/css/bootstrap.min.css',
      targetStyles:['padding','color','margin'],
      ignoreElements:['a','button'],
      documentTitle: `Submission ID ${this.submissionId}.pdf`
    })
    }

}
